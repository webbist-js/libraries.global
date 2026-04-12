import * as THREE from "three"

export function createSeededRandom(seed: number) {
  return () => {
    seed = Math.trunc(seed)
    seed = Math.trunc(seed + 0x6d2b79f5)
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value

    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export type ActivitySource = {
  position: THREE.Vector3
  radius: number
  weight: number
}

export function createLandDotsGeometry({
  maskImage,
  radius,
  density = 1,
  latBounds = [-62, 82],
  lngBounds = [-180, 180],
  activitySources = [],
}: {
  maskImage: HTMLImageElement | null
  radius: number
  density?: number
  latBounds?: [number, number]
  lngBounds?: [number, number]
  activitySources?: ActivitySource[]
}) {
  if (maskImage == null) {
    return new THREE.BufferGeometry()
  }

  const maskCanvas = document.createElement("canvas")
  const maskContext = maskCanvas.getContext("2d", { willReadFrequently: true })

  if (maskContext == null) {
    return new THREE.BufferGeometry()
  }

  const width = maskImage.naturalWidth || maskImage.width
  const height = maskImage.naturalHeight || maskImage.height

  if (width === 0 || height === 0) {
    return new THREE.BufferGeometry()
  }

  maskCanvas.width = width
  maskCanvas.height = height
  maskContext.drawImage(maskImage, 0, 0, width, height)

  const pixelData = maskContext.getImageData(0, 0, width, height).data
  const positions: number[] = []
  const sizes: number[] = []
  const intensities: number[] = []
  const phases: number[] = []
  const activities: number[] = []

  const latitudeStep = 0.5 / density
  const random = createSeededRandom(37)

  const latMin = latBounds[0]
  const latMax = latBounds[1]
  const lngMin = lngBounds[0]
  const lngMax = lngBounds[1]

  for (let lat = latMin; lat <= latMax; lat += latitudeStep) {
    const cosLat = Math.max(Math.cos(THREE.MathUtils.degToRad(lat)), 0.28)
    const longitudeStep = latitudeStep / cosLat

    for (let lng = lngMin; lng <= lngMax; lng += longitudeStep) {
      const jitteredLat = lat + (random() - 0.5) * latitudeStep * 0.62
      const jitteredLng = lng + (random() - 0.5) * longitudeStep * 0.38
      const x = Math.floor(((jitteredLng + 180) / 360) * (width - 1))
      const y = Math.floor(((90 - jitteredLat) / 180) * (height - 1))
      const pixelIndex = (y * width + x) * 4
      const brightness =
        (pixelData[pixelIndex]! +
          pixelData[pixelIndex + 1]! +
          pixelData[pixelIndex + 2]!) /
        3

      if (brightness > 112) {
        continue
      }

      if (random() < 0.004 + (brightness / 112) * 0.045) {
        continue
      }

      // Convert LatLng to Vector3
      const latRad = THREE.MathUtils.degToRad(jitteredLat)
      const lngRad = THREE.MathUtils.degToRad(jitteredLng)
      const cosJitterLat = Math.cos(latRad)
      const r = radius + 0.0055 + random() * 0.0075

      const pt = new THREE.Vector3(
        cosJitterLat * Math.sin(lngRad) * r,
        Math.sin(latRad) * r,
        cosJitterLat * Math.cos(lngRad) * r
      )

      let activityScore = 0
      activitySources.forEach((source) => {
        const distance = pt.distanceTo(source.position)
        const influence = Math.max(0, 1 - distance / source.radius)
        activityScore += influence * influence * source.weight
      })
      const activity = 1 - Math.exp(-activityScore * 0.65)

      positions.push(pt.x, pt.y, pt.z)
      sizes.push(0.78 + random() * 0.42)
      intensities.push(0.5 + random() * 0.5)
      phases.push(random() * Math.PI * 2)
      activities.push(activity)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  )
  geometry.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1))
  geometry.setAttribute(
    "intensity",
    new THREE.Float32BufferAttribute(intensities, 1)
  )
  geometry.setAttribute("phase", new THREE.Float32BufferAttribute(phases, 1))
  geometry.setAttribute(
    "activity",
    new THREE.Float32BufferAttribute(activities, 1)
  )
  geometry.computeBoundingSphere()

  return geometry
}

export function createLandGlowGeometry(sourceGeometry: THREE.BufferGeometry) {
  const positionAttribute = sourceGeometry.getAttribute(
    "position"
  ) as THREE.BufferAttribute
  const sizeAttribute = sourceGeometry.getAttribute(
    "size"
  ) as THREE.BufferAttribute
  const intensityAttribute = sourceGeometry.getAttribute(
    "intensity"
  ) as THREE.BufferAttribute
  const phaseAttribute = sourceGeometry.getAttribute(
    "phase"
  ) as THREE.BufferAttribute
  const activityAttribute = sourceGeometry.getAttribute(
    "activity"
  ) as THREE.BufferAttribute

  if (
    !positionAttribute ||
    !sizeAttribute ||
    !intensityAttribute ||
    !phaseAttribute ||
    !activityAttribute
  ) {
    return new THREE.BufferGeometry()
  }

  const positions: number[] = []
  const sizes: number[] = []
  const intensities: number[] = []
  const phases: number[] = []
  const activities: number[] = []
  const random = createSeededRandom(913)

  for (let index = 0; index < positionAttribute.count; index += 1) {
    const activity = activityAttribute.getX(index)
    const intensity = intensityAttribute.getX(index)
    const weight =
      activity * 0.82 + Math.max(0, intensity - 0.62) * 0.72 + intensity * 0.1

    if (weight < 0.24) continue

    const sampleChance = THREE.MathUtils.clamp(0.16 + weight * 0.42, 0.18, 0.6)
    if (random() > sampleChance) continue

    positions.push(
      positionAttribute.getX(index),
      positionAttribute.getY(index),
      positionAttribute.getZ(index)
    )
    sizes.push(sizeAttribute.getX(index) * (1.35 + activity * 0.5))
    intensities.push(intensity)
    phases.push(phaseAttribute.getX(index))
    activities.push(activity)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  )
  geometry.setAttribute("size", new THREE.Float32BufferAttribute(sizes, 1))
  geometry.setAttribute(
    "intensity",
    new THREE.Float32BufferAttribute(intensities, 1)
  )
  geometry.setAttribute("phase", new THREE.Float32BufferAttribute(phases, 1))
  geometry.setAttribute(
    "activity",
    new THREE.Float32BufferAttribute(activities, 1)
  )
  geometry.computeBoundingSphere()

  return geometry
}
