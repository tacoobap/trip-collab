import satori from 'satori'
import { initWasm, Resvg } from '@resvg/resvg-wasm'
import { encode as encodeJpeg } from 'jpeg-js'

/**
 * The 1200x630 image a messaging app shows above a shared Trup link.
 *
 * Same composition as `ItineraryHero`: the trip's cover photo, the app's
 * bottom-weighted scrim, and the `Trup` lockup sitting above the trip name.
 * Satori lays the card out and converts every glyph to a path, so the SVG it
 * hands resvg carries no font dependency of its own.
 */

const W = 1200
const H = 630
const GOLDEN = '#dda23c'

export interface CardFonts {
  playfair400: ArrayBuffer
  playfair600: ArrayBuffer
  dmSans400: ArrayBuffer
}

export interface CardInput {
  /** The cover photo as a data URI, or null to fall back to the brand gradient. */
  hero: string | null
  name: string
  /** Destinations and dates, e.g. "Barcelona · Girona — Sep 12–18, 2026". */
  meta: string
}

type Node = { type: string; props: Record<string, unknown> }

const h = (
  type: string,
  style: Record<string, unknown>,
  children?: unknown
): Node => ({ type, props: { style, ...(children === undefined ? {} : { children }) } })

/**
 * Trip names run from "Rome" to a sentence. Step the display size down so a
 * long one wraps to two lines instead of three, which would collide with the
 * lockup above it.
 */
function nameSize(name: string): number {
  if (name.length <= 20) return 78
  if (name.length <= 32) return 64
  if (name.length <= 48) return 52
  return 44
}

/**
 * Satori drops the space in ", 2026" — it segments a comma followed by digits
 * as one numeric token and normalises the gap away, which prints "18,2026".
 * A non-breaking space survives that pass. The line never wraps, so nothing is
 * lost by making it unbreakable.
 */
const metaText = (meta: string): string => meta.toUpperCase().replace(/, /g, ',\u00A0')

function card({ hero, name, meta }: CardInput): Node {
  const size = nameSize(name)

  const layers: Node[] = []

  if (hero) {
    layers.push({
      type: 'img',
      props: {
        src: hero,
        width: W,
        height: H,
        style: { position: 'absolute', top: 0, left: 0, width: W, height: H, objectFit: 'cover' },
      },
    })
  }

  // from-black/80 via-black/25 to-black/5, bottom to top — ItineraryHero's scrim
  layers.push(
    h('div', {
      position: 'absolute',
      top: 0,
      left: 0,
      width: W,
      height: H,
      backgroundImage:
        'linear-gradient(to top, rgba(0,0,0,0.80) 0%, rgba(0,0,0,0.25) 52%, rgba(0,0,0,0.05) 100%)',
    })
  )

  layers.push(
    h(
      'div',
      {
        position: 'absolute',
        top: 0,
        left: 0,
        width: W,
        height: H,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 90px',
      },
      [
        h(
          'div',
          {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: 30,
          },
          [
            h(
              'div',
              {
                fontFamily: 'Playfair Display',
                fontWeight: 600,
                fontSize: 34,
                lineHeight: 1,
                letterSpacing: -0.34,
                color: '#ffffff',
              },
              'Trup'
            ),
            h('div', { width: 40, height: 3, marginTop: 9, backgroundColor: GOLDEN, borderRadius: 2 }),
          ]
        ),
        h(
          'div',
          {
            fontFamily: 'Playfair Display',
            fontWeight: 400,
            fontSize: size,
            lineHeight: 1.06,
            letterSpacing: size * -0.02,
            color: '#ffffff',
            textAlign: 'center',
            display: 'flex',
          },
          name
        ),
        ...(meta
          ? [
              h(
                'div',
                {
                  fontFamily: 'DM Sans',
                  fontWeight: 400,
                  fontSize: 19,
                  letterSpacing: 4.18,
                  color: 'rgba(255,255,255,0.82)',
                  marginTop: 26,
                  textAlign: 'center',
                  display: 'flex',
                },
                metaText(meta)
              ),
            ]
          : []),
      ]
    )
  )

  return h(
    'div',
    {
      position: 'relative',
      width: W,
      height: H,
      display: 'flex',
      // Stands in for the photo when a trip has no cover yet — the same
      // navy/sage/golden wash ItineraryHero shows behind an empty hero.
      backgroundColor: '#293c56',
      ...(hero
        ? {}
        : { backgroundImage: 'linear-gradient(135deg, #293c56 0%, #4a6a5c 55%, #a8802f 100%)' }),
    },
    layers
  )
}

let wasmReady: Promise<void> | null = null

/** resvg's wasm is initialised once per container and reused while it is warm. */
export function initCardRenderer(wasm: ArrayBuffer | Uint8Array): Promise<void> {
  if (!wasmReady) {
    wasmReady = initWasm(wasm).catch((err) => {
      // A failed init must not poison every later invocation on this container
      wasmReady = null
      throw err
    })
  }
  return wasmReady
}

/**
 * JPEG, not the PNG resvg hands back: a photo at this size encodes to ~1.5 MB as
 * PNG, and WhatsApp quietly drops previews well below that. resvg exposes the
 * raw RGBA buffer, so this re-encodes without a decode step in between.
 */
export async function renderCard(input: CardInput, fonts: CardFonts): Promise<Buffer> {
  const svg = await satori(card(input) as never, {
    width: W,
    height: H,
    fonts: [
      { name: 'Playfair Display', data: fonts.playfair400, weight: 400, style: 'normal' },
      { name: 'Playfair Display', data: fonts.playfair600, weight: 600, style: 'normal' },
      { name: 'DM Sans', data: fonts.dmSans400, weight: 400, style: 'normal' },
    ],
  })

  const rendered = new Resvg(svg, {
    fitTo: { mode: 'width', value: W },
    font: { loadSystemFonts: false },
  }).render()

  const { width, height, pixels } = rendered
  const jpeg = encodeJpeg({ data: Buffer.from(pixels), width, height }, 82)
  rendered.free()
  return jpeg.data
}
