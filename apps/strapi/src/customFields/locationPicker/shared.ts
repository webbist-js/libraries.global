export const LOCATION_PICKER_FIELD_NAME = "location-picker"

export interface LocationPickerValue {
  lat: number
  lng: number
  address?: string | null
}
