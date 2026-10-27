import { errors } from "@strapi/utils"

function reserveServiceHub(event: { params: { data: { slug?: unknown } } }) {
  if (event.params.data.slug === "library-services")
    throw new errors.ValidationError(
      "library-services is reserved for the country's service directory"
    )
}

export default {
  beforeCreate: reserveServiceHub,
  beforeUpdate: reserveServiceHub,
}
