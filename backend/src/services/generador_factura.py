# -*- coding: utf-8 -*-
"""Representación gráfica propia de la factura electrónica DIAN (DT Growth).
La factura oficial es el XML firmado (Factus); este PDF es la representación
con la marca de DT Growth, e incluye lo exigido: número, CUFE, QR de la DIAN
y resolución de numeración. Uso: python3 generador_factura.py <datos.json>
Imprime la ruta del PDF generado."""
import os
import sys
import json
import qrcode
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

AZUL = colors.HexColor('#1663a7')
GRIS = colors.HexColor('#555555')

def envolver_texto(c, texto, fuente, tam, ancho_max, max_lineas=3):
    """Parte `texto` en hasta `max_lineas` líneas que quepan en `ancho_max`.
    Si sobra texto después de la última línea permitida, la corta con "…"
    (en vez de perder contenido en silencio, como hacía el truncado anterior)."""
    palabras = texto.split()
    lineas = []
    actual = ''
    idx = 0
    while idx < len(palabras) and len(lineas) < max_lineas:
        palabra = palabras[idx]
        prueba = f'{actual} {palabra}'.strip()
        if not actual or c.stringWidth(prueba, fuente, tam) <= ancho_max:
            actual = prueba
            idx += 1
        else:
            lineas.append(actual)
            actual = ''
    if actual and len(lineas) < max_lineas:
        lineas.append(actual)
        actual = ''
    if idx < len(palabras) or actual:
        # quedó texto sin ubicar: se corta la última línea con "…"
        ultima = lineas[-1] if lineas else actual
        while ultima and c.stringWidth(ultima + '…', fuente, tam) > ancho_max:
            ultima = ultima.rsplit(' ', 1)[0] if ' ' in ultima else ultima[:-1]
        lineas = (lineas[:-1] if lineas else []) + [f'{ultima}…' if ultima else '…']
    return lineas or ['']

def generar(d):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # fuentes de la marca (mismas de la cuenta de cobro)
    try:
        fdir = os.path.join(script_dir, 'fuentes')
        pdfmetrics.registerFont(TTFont('HN-Normal', os.path.join(fdir, 'HelveticaNeueLight.ttf')))
        pdfmetrics.registerFont(TTFont('HN-Bold', os.path.join(fdir, 'HelveticaNeueBold.ttf')))
        fn, fb = 'HN-Normal', 'HN-Bold'
    except Exception:
        fn, fb = 'Helvetica', 'Helvetica-Bold'

    out_dir = os.path.join(script_dir, 'creadas')
    os.makedirs(out_dir, exist_ok=True)
    ruta = os.path.join(out_dir, f"factura_{d['numero']}.pdf")
    c = canvas.Canvas(ruta, pagesize=letter)
    W, H = letter

    # fondo de marca (banda superior con logo + pie)
    for nombre in ('base.jpg', 'base.png'):
        p = os.path.join(script_dir, nombre)
        if os.path.exists(p):
            c.drawImage(p, 0, 0, width=W, height=H)
            break

    mi = 60  # margen izquierdo
    y = H - 150

    # título + número
    c.setFillColor(AZUL)
    c.setFont(fb, 20)
    c.drawString(mi, y, 'FACTURA ELECTRÓNICA DE VENTA')
    c.setFont(fb, 14)
    c.drawString(mi, y - 22, f"N° {d['numero']}")

    # QR DIAN (derecha)
    qr_img = qrcode.make(d['qr_url'], box_size=4, border=1)
    qr_path = ruta + '.qr.png'
    qr_img.save(qr_path)
    c.drawImage(ImageReader(qr_path), W - 60 - 110, y - 88, width=110, height=110)
    os.remove(qr_path)

    # emisor
    y -= 50
    c.setFillColor(colors.black)
    c.setFont(fb, 10)
    c.drawString(mi, y, 'DT GROWTH PARTNERS — Dairo Alberto Traslaviña Torres')
    c.setFont(fn, 9)
    for linea in ('NIT: 1143397563-9 · Tel: +57 300 718 9383 · facturacion@dtgrowthpartners.com',
                  'Carrera 2 # 13-37 AP 02, Bocagrande · Cartagena, Colombia'):
        y -= 13
        c.drawString(mi, y, linea)

    # cliente
    y -= 28
    c.setFillColor(AZUL); c.setFont(fb, 10)
    c.drawString(mi, y, 'FACTURADO A')
    c.setFillColor(colors.black); c.setFont(fn, 9)
    for etiqueta, valor in (('Cliente', d['cliente']), ('CC/NIT', d['identificacion']),
                            ('Fecha de emisión', d['fecha']), ('Municipio', d.get('municipio', ''))):
        if not valor:
            continue
        y -= 13
        c.setFont(fb, 9); c.drawString(mi, y, f'{etiqueta}: ')
        c.setFont(fn, 9); c.drawString(mi + c.stringWidth(f'{etiqueta}: ', fb, 9), y, str(valor))

    # tabla de items
    y -= 30
    c.setFillColor(AZUL)
    c.rect(mi, y - 6, W - 2 * mi, 20, fill=1, stroke=0)
    c.setFillColor(colors.white); c.setFont(fb, 9)
    c.drawString(mi + 8, y, 'Descripción')
    c.drawRightString(W - mi - 150, y, 'Cant.')
    c.drawRightString(W - mi - 8, y, 'Valor')
    c.setFillColor(colors.black); c.setFont(fn, 9)
    ancho_desc = W - 2 * mi - 180
    for it in d['items']:
        lineas = envolver_texto(c, it['descripcion'], fn, 9, ancho_desc, max_lineas=3)
        y -= 20
        c.drawString(mi + 8, y, lineas[0])
        c.drawRightString(W - mi - 150, y, str(it.get('cantidad', 1)))
        c.drawRightString(W - mi - 8, y, f"$ {it['valor']:,.0f}".replace(',', '.'))
        for linea_extra in lineas[1:]:
            y -= 12
            c.drawString(mi + 8, y, linea_extra)
    y -= 8
    c.setStrokeColor(colors.HexColor('#dddddd'))
    c.line(mi, y, W - mi, y)
    y -= 18
    c.setFont(fb, 11)
    c.drawString(mi + 8, y, 'TOTAL')
    c.setFillColor(AZUL)
    c.drawRightString(W - mi - 8, y, f"$ {d['total']:,.0f} COP".replace(',', '.'))
    c.setFillColor(colors.black)

    # observaciones
    if d.get('observaciones'):
        y -= 30
        c.setFont(fb, 9); c.drawString(mi, y, 'Observaciones:')
        c.setFont(fn, 8.5); c.setFillColor(GRIS)
        texto = d['observaciones']
        while texto and y > 210:
            linea = texto
            while c.stringWidth(linea, fn, 8.5) > W - 2 * mi and ' ' in linea:
                linea = linea.rsplit(' ', 1)[0]
            y -= 12
            c.drawString(mi, y, linea)
            texto = texto[len(linea):].strip()
        c.setFillColor(colors.black)

    # detalles de pago
    y -= 28
    c.setFillColor(AZUL); c.setFont(fb, 9)
    c.drawString(mi, y, 'MEDIOS DE PAGO')
    c.setFillColor(colors.black); c.setFont(fn, 8.5)
    for linea in ('Dairo Traslaviña · CC 1143397563',
                  'Cuenta de ahorros Bancolombia: 78841707710',
                  'Nequi / Daviplata: 3007189383 · Bre-B: 1143397563'):
        y -= 12
        c.drawString(mi, y, linea)

    # --- pie legal (obligatorio DIAN) + cierre de marca ---
    # La plantilla base trae eslogan y contactos en dos renglones; se cubren para
    # armar aquí el bloque legal con aire y cerrar en una sola línea.
    c.setFillColor(colors.white)
    c.rect(0, 26, W, 112, fill=1, stroke=0)

    c.setStrokeColor(colors.HexColor('#e4e4e4')); c.setLineWidth(0.6)
    c.line(mi, 128, W - mi, 128)

    c.setFont(fn, 6.5); c.setFillColor(GRIS)
    cufe = f"CUFE: {d['cufe']}"
    if c.stringWidth(cufe, fn, 6.5) > W - 2 * mi:
        mitad = len(cufe) // 2
        c.drawCentredString(W / 2, 115, cufe[:mitad])
        c.drawCentredString(W / 2, 107, cufe[mitad:])
        y_leg = 96
    else:
        c.drawCentredString(W / 2, 115, cufe)
        y_leg = 104
    c.drawCentredString(W / 2, y_leg, d['resolucion'])
    c.drawCentredString(W / 2, y_leg - 9,
                        'Factura electrónica validada por la DIAN · Representación gráfica generada por DT-OS · Proveedor tecnológico: Factus')

    # separador con el triángulo de la marca
    c.setStrokeColor(AZUL); c.setLineWidth(0.8)
    c.line(mi + 70, 62, W / 2 - 9, 62)
    c.line(W / 2 + 9, 62, W - mi - 70, 62)
    tri = c.beginPath(); tri.moveTo(W / 2 - 5, 65); tri.lineTo(W / 2 + 5, 65); tri.lineTo(W / 2, 58); tri.close()
    c.setFillColor(AZUL); c.drawPath(tri, fill=1, stroke=0)

    # cierre: eslogan y contacto en un solo renglón
    c.setFont(fn, 8.5); c.setFillColor(GRIS)
    c.drawCentredString(W / 2, 44,
                        'Estrategia, tecnología y ejecución para crecer.   ·   dtgrowthpartners.com   ·   +57 300 718 9383')

    c.save()
    return ruta

if __name__ == '__main__':
    with open(sys.argv[1], encoding='utf-8') as f:
        datos = json.load(f)
    print(generar(datos))
