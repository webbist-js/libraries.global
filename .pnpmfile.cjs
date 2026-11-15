/** The published icon picker is prebuilt; its SDK is build tooling, not a runtime peer. */
module.exports = {
  hooks: {
    readPackage(pkg) {
      if (
        pkg.name === "@arshiash80/strapi-plugin-iconhub" &&
        pkg.version === "1.3.1"
      ) {
        delete pkg.peerDependencies["@strapi/sdk-plugin"]
      }
      return pkg
    },
  },
}
