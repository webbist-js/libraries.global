import { expect, test } from "@playwright/test"

import { HALO_FRAGMENT_SHADER } from "../../../../apps/ui/src/components/helpers/globe-shaders"

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "GLSL regression uses Chromium's software GPU"
)
test.use({
  launchOptions: {
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  },
})

// Exercise the production GLSL, including the negative facing values produced
// by GlobeShell's BackSide materials. DOM-only canvas mocks miss this failure.
for (const layer of [
  { name: "rim", c: 0.66, power: 6, opacity: 0.42 * 1.45 },
  { name: "halo", c: 0.72, power: 3.2, opacity: 0.16 * 1.45 },
]) {
  test(`${layer.name} fades out instead of becoming an opaque atmosphere band`, async ({
    page,
  }) => {
    const samples = await page.evaluate(
      ({ fragment, layer }) => {
        const canvas = document.createElement("canvas")
        canvas.width = canvas.height = 1
        const gl = canvas.getContext("webgl", { premultipliedAlpha: false })
        if (!gl) throw new Error("WebGL is required for globe shader coverage")
        const compile = (type: number, source: string) => {
          const shader = gl.createShader(type)!
          gl.shaderSource(shader, source)
          gl.compileShader(shader)
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
            throw new Error(
              gl.getShaderInfoLog(shader) ?? "Shader compile failed"
            )

          return shader
        }
        const vertex = compile(
          gl.VERTEX_SHADER,
          `
        attribute vec2 position;
        uniform float facing;
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vNormal = vec3(sqrt(1.0 - facing * facing), 0.0, facing);
          vViewPosition = vec3(0.0, 0.0, 1.0);
          gl_Position = vec4(position, 0.0, 1.0);
        }
      `
        )
        const pixel = compile(
          gl.FRAGMENT_SHADER,
          `precision highp float;\n${fragment}`
        )
        const program = gl.createProgram()!
        gl.attachShader(program, vertex)
        gl.attachShader(program, pixel)
        gl.linkProgram(program)
        if (!gl.getProgramParameter(program, gl.LINK_STATUS))
          throw new Error(gl.getProgramInfoLog(program) ?? "Shader link failed")
        gl.useProgram(program)
        const buffer = gl.createBuffer()
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 3, -1, -1, 3]),
          gl.STATIC_DRAW
        )
        const position = gl.getAttribLocation(program, "position")
        gl.enableVertexAttribArray(position)
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
        gl.uniform3f(gl.getUniformLocation(program, "uColor"), 0.5, 0.4, 0.9)
        gl.uniform1f(gl.getUniformLocation(program, "uC"), layer.c)
        gl.uniform1f(gl.getUniformLocation(program, "uP"), layer.power)
        gl.uniform1f(gl.getUniformLocation(program, "uOpacity"), layer.opacity)
        const results = [0, -0.05, -0.15, -0.3, -0.5, -0.75, -1].map(
          (facing) => {
            gl.clearColor(0, 0, 0, 0)
            gl.clear(gl.COLOR_BUFFER_BIT)
            gl.uniform1f(gl.getUniformLocation(program, "facing"), facing)
            gl.drawArrays(gl.TRIANGLES, 0, 3)
            const rgba = new Uint8Array(4)
            gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba)

            return rgba[3]! / 255
          }
        )
        gl.deleteBuffer(buffer)
        gl.deleteProgram(program)
        gl.deleteShader(vertex)
        gl.deleteShader(pixel)
        gl.getExtension("WEBGL_lose_context")?.loseContext()

        return results
      },
      { fragment: HALO_FRAGMENT_SHADER, layer }
    )

    expect(samples[0], "outer silhouette must blend into the page").toBe(0)
    expect(samples.at(-1), "back face must not flood the atmosphere").toBe(0)
    expect(Math.max(...samples), "glow should remain visible").toBeGreaterThan(
      0
    )
    expect(
      Math.max(...samples),
      "glow must stay translucent before bloom"
    ).toBeLessThan(0.08)
  })
}
