const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`

module.exports = {
  "*.{js,jsx,ts,tsx}": (files) => {
    const storybook = files.filter((file) =>
      /[/\\]apps[/\\]storybook[/\\]/.test(file)
    )
    const application = files.filter((file) => !storybook.includes(file))

    return [
      ...(application.length
        ? [`eslint --fix ${application.map(quote).join(" ")}`]
        : []),
      ...(storybook.length
        ? [
            `pnpm --dir apps/storybook exec eslint --fix ${storybook.map(quote).join(" ")}`,
          ]
        : []),
    ]
  },
  "*.{md,css,scss}": ["prettier --write"],
}
