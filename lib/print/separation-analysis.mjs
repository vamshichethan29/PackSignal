/**
 * PackSignal Physical Prepress — Color Separation & Spot Plate Analysis
 * (lib/print/separation-analysis.mjs)
 *
 * Implements E1.3, E1.7:
 * Inspects process plates (C, M, Y, K), spot color channels, finish layers,
 * and registration risks (e.g. 4-color rich black on fine typography,
 * multichannel barcode lines, spot white underprint).
 */

import { getPressProfile } from './press-profiles.mjs';

export function analyzeSeparations({
  colorPlates = [],
  spotColors = [],
  textObjects = [],
  barcodeObjects = [],
  pressProfileId = 'ISO-OFFSET-COATED-300',
} = {}) {
  const profile = typeof pressProfileId === 'object' ? pressProfileId : getPressProfile(pressProfileId);

  const findings = [];
  const plates = new Set(colorPlates);

  // 1. Process plate inventory
  const processPlatesPresent = ['Cyan', 'Magenta', 'Yellow', 'Black'].filter(p => plates.has(p) || plates.has(p.toLowerCase()));

  // 2. Spot / Technical layers inventory
  const spots = spotColors.map(s => {
    const name = typeof s === 'string' ? s : (s.name || 'Unknown Spot');
    const isTechnical = /cut|crease|dieline|contour|guide|fold/i.test(name);
    const isVarnishOrFinish = /varnish|gloss|uv|foil|emboss|lacquer/i.test(name);
    const isWhiteUnderprint = /white|opaque/i.test(name);

    return {
      name,
      type: isTechnical ? 'TECHNICAL_LAYER' : (isVarnishOrFinish ? 'FINISH_COATING' : (isWhiteUnderprint ? 'WHITE_UNDERPRINT' : 'SPOT_COLOR_INK')),
      alternateColorSpace: s.alternateSpace || 'DeviceCMYK',
    };
  });

  // 3. Registration Risk: 4-Color Rich Black on Small Text (< 10 pt)
  const richBlackTextViolations = [];
  for (const t of textObjects) {
    if (t.sizePt && t.sizePt < 10 && t.color) {
      const { c = 0, m = 0, y = 0, k = 0 } = t.color;
      // If text is printed with multiple non-zero process colors
      const nonZeroChannels = [c, m, y].filter(v => v > 15).length;
      if (nonZeroChannels >= 2 && k > 40) {
        richBlackTextViolations.push({
          text: t.text || 'Fine Text',
          sizePt: t.sizePt,
          box: t.box,
          page: t.page || 1,
          channels: { c, m, y, k },
          measuredTac: c + m + y + k,
        });
      }
    }
  }

  if (richBlackTextViolations.length > 0) {
    findings.push({
      id: 'preflight-rich-black-text',
      title: 'Rich Black on Fine Typography',
      status: 'issue',
      verdict: 'RICH_BLACK_SMALL_TEXT_DEFECT',
      severity: 'major',
      expected: 'Fine text (< 10 pt) must be 100% K (single-plate black) to prevent press misregistration blur.',
      observed: `${richBlackTextViolations.length} small text elements rendered with multi-color rich black (e.g. "${richBlackTextViolations[0]?.text}" at ${richBlackTextViolations[0]?.sizePt} pt: C:${richBlackTextViolations[0]?.channels.c}% M:${richBlackTextViolations[0]?.channels.m}% Y:${richBlackTextViolations[0]?.channels.y}% K:${richBlackTextViolations[0]?.channels.k}%).`,
      explanation: 'Prepress registration defect: Fine type printed across multiple color plates produces colored halos and illegibility when slight press register shift occurs.',
      violations: richBlackTextViolations,
      ruleCitation: 'ISO 12647-2 Prepress Production Standard §5.3 (Fine Text Plate Allocation)',
    });
  }

  // 4. Barcode Multichannel Screening
  const barcodeChannelViolations = [];
  for (const b of barcodeObjects) {
    if (b.color) {
      const { c = 0, m = 0, y = 0, k = 0 } = b.color;
      if ((c > 10 || m > 10 || y > 10) && k > 0) {
        barcodeChannelViolations.push({
          barcode: b.barcode || 'EAN/UPC',
          channels: { c, m, y, k },
        });
      }
    }
  }

  if (barcodeChannelViolations.length > 0) {
    findings.push({
      id: 'preflight-barcode-multichannel',
      title: 'Multichannel Barcode Color Separation',
      status: 'issue',
      verdict: 'BARCODE_PRINT_CHANNEL_DEFECT',
      severity: 'critical',
      expected: 'Barcode bars must be printed on a single solid dark plate (typically 100% Black) with no process color screening.',
      observed: `Barcode lines contain process color inks (C:${barcodeChannelViolations[0]?.channels.c}% M:${barcodeChannelViolations[0]?.channels.m}% Y:${barcodeChannelViolations[0]?.channels.y}% K:${barcodeChannelViolations[0]?.channels.k}%).`,
      explanation: 'GS1 Print Quality hazard: Barcodes screened across multiple plates fail scanner edge contrast and edge determination tests.',
      ruleCitation: 'GS1 General Specifications §5.4.3 (Symbol Quality & Colorant Selection)',
    });
  }

  // 5. White underprint check for flexible film / metallic substrates
  if (profile.spotColorPolicy === 'WHITE_UNDERPRINT_MANDATORY_ON_FILM') {
    const hasWhite = spots.some(s => s.type === 'WHITE_UNDERPRINT');
    if (!hasWhite) {
      findings.push({
        id: 'preflight-missing-white-underprint',
        title: 'Missing White Opaque Plate on Transparent Film',
        status: 'review',
        verdict: 'WHITE_UNDERPRINT_ABSENT',
        severity: 'major',
        expected: 'Opaque White backing separation required for transparent film substrate to ensure text opacity and barcode contrast.',
        observed: 'No Spot White / Opaque White plate detected in document color separations.',
        explanation: `${profile.name} mandates an opaque white underprint layer for non-opaque substrate. Without white backing, inks will be semi-transparent when filled with product.`,
        ruleCitation: profile.source,
      });
    }
  }

  return {
    pressProfile: profile.profileId,
    processPlates: processPlatesPresent,
    spotPlates: spots,
    findings,
    summary: {
      totalPlates: processPlatesPresent.length + spots.length,
      hasRichBlackSmallText: richBlackTextViolations.length > 0,
      hasMultichannelBarcode: barcodeChannelViolations.length > 0,
    },
  };
}
