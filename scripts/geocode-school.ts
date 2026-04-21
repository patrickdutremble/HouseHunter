import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })

const ADDRESS = 'Secondary School Leblanc, Terrebonne, QC'

async function main() {
  const key = process.env.GOOGLE_MAPS_API_KEY
  if (!key) {
    console.error('Missing GOOGLE_MAPS_API_KEY in env')
    process.exit(1)
  }
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', ADDRESS)
  url.searchParams.set('region', 'ca')
  url.searchParams.set('key', key)
  const res = await fetch(url)
  const data = await res.json()
  if (data.status !== 'OK' || !data.results?.length) {
    console.error('Geocoding failed:', data.status, data.error_message ?? '')
    process.exit(1)
  }
  const loc = data.results[0].geometry.location
  console.log(JSON.stringify({
    formatted: data.results[0].formatted_address,
    lat: loc.lat,
    lon: loc.lng,
  }, null, 2))
}

main()
