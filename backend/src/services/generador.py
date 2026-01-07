import os
import sys
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.pdfgen import canvas
from datetime import datetime
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generar_cuenta_de_cobro(nombre_cliente: str, identificacion: str, servicios: list, observaciones: str, concepto: str, fecha: str, servicio_proyecto: str = None) -> str:
    """
    Genera una cuenta de cobro en formato PDF con una tabla detallada de servicios.

    Args:
        nombre_cliente: El nombre del cliente.
        identificacion: La identificación del cliente.
        servicios: Una lista de diccionarios con 'nombre_servicio', 'descripcion', 'cantidad', 'precio_unitario'.
        observaciones: Una cadena de texto con las observaciones a incluir.
        concepto: El concepto general de la cuenta de cobro.
        fecha: La fecha de la cuenta de cobro.
        servicio_proyecto: Nombres de los servicios/proyectos separados por comas.

    Returns:
        La ruta del archivo PDF generado.
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    # --- DATOS DEL EMISOR ---
    emisor_nombre = "Dairo Tralasviña"
    emisor_cedula = "1143397563"
    emisor_telefono = "+57 3007189383"
    emisor_email = "Dairo@dtgrowthpartners.com"
    emisor_ciudad = "Cartagena, Colombia"
    cuenta_bancolombia = "78841707710"
    nequi = "3007189383"

    # --- REGISTRAR FUENTES ---
    # Try to load custom fonts, fallback to standard fonts
    use_custom_fonts = False
    fuentes_dir = os.path.join(script_dir, 'fuentes')

    try:
        if os.path.isdir(fuentes_dir):
            mapa_fuentes = {'HN-Normal': 'HelveticaNeueLight.ttf', 'HN-Bold': 'HelveticaNeueBold.ttf', 'HN-Italic': 'HelveticaNeueItalic.ttf'}
            for nombre, archivo in mapa_fuentes.items():
                ruta_fuente = os.path.join(fuentes_dir, archivo)
                if os.path.exists(ruta_fuente):
                    pdfmetrics.registerFont(TTFont(nombre, ruta_fuente))
            pdfmetrics.registerFontFamily('HelveticaNeue', normal='HN-Normal', bold='HN-Bold', italic='HN-Italic')
            use_custom_fonts = True
    except Exception as e:
        print(f"Warning: Could not load custom fonts, using standard fonts: {e}", file=sys.stderr)
        use_custom_fonts = False

    # Define font names based on availability
    if use_custom_fonts:
        font_normal = 'HN-Normal'
        font_bold = 'HN-Bold'
    else:
        font_normal = 'Helvetica'
        font_bold = 'Helvetica-Bold'

    # --- RUTA IMAGEN BASE ---
    archivo_base = None
    try:
        for nombre in ["base.jpg", "base.png"]:
            path_completo = os.path.join(script_dir, nombre)
            if os.path.exists(path_completo):
                # Test if the image can be read
                from PIL import Image
                Image.open(path_completo).verify()
                archivo_base = path_completo
                break
    except Exception as e:
        print(f"Warning: Could not load base image, continuing without it: {e}", file=sys.stderr)
        archivo_base = None

    # --- GENERACIÓN DEL PDF ---
    numero_cuenta = datetime.now().strftime("%Y%m%d%H%M%S")
    # Sanitize client name for filename - keep only ASCII letters, numbers, spaces
    nombre_cliente_sanitizado = ''.join(c for c in nombre_cliente if ord(c) < 128 and (c.isalnum() or c.isspace()))
    nombre_cliente_sanitizado = nombre_cliente_sanitizado.replace(' ', '_').strip('_')
    # Ensure it's not empty
    if not nombre_cliente_sanitizado:
        nombre_cliente_sanitizado = 'cliente'
    nombre_archivo = f"cuenta_cobro_{nombre_cliente_sanitizado}_{numero_cuenta}.pdf"
    os.makedirs(os.path.join(script_dir, 'creadas'), exist_ok=True)
    ruta_salida = os.path.join(script_dir, 'creadas', nombre_archivo)

    c = canvas.Canvas(ruta_salida, pagesize=letter)
    width, height = letter

    if archivo_base:
        try:
            # Draw as full page background with cover-like scaling
            from PIL import Image
            img = Image.open(archivo_base)
            img_width, img_height = img.size

            # Calculate scale to cover the entire page (like object-fit: cover)
            scale_x = width / img_width
            scale_y = height / img_height
            scale = max(scale_x, scale_y)  # Use the larger scale to cover

            # Calculate new dimensions
            new_width = img_width * scale
            new_height = img_height * scale

            # Center the image on the page
            x_offset = (width - new_width) / 2
            y_offset = (height - new_height) / 2

            c.drawImage(archivo_base, x_offset, y_offset, width=new_width, height=new_height, preserveAspectRatio=True)
        except Exception as e:
            print(f"Warning: Could not draw base image, continuing without it: {e}", file=sys.stderr)

    margen_izquierdo = 40
    c.setFont(font_normal, 22)
    c.setFillColor(colors.HexColor("#005F99"))
    c.drawCentredString(width / 2.0, height - 120, f"CUENTA DE COBRO N.° {numero_cuenta}")

    y = height - 160
    c.setFont(font_normal, 9)
    c.setFillColor(colors.HexColor("#005F99"))
    c.drawString(margen_izquierdo, y, emisor_telefono)
    y -= 12
    c.drawString(margen_izquierdo, y, emisor_email)
    y -= 12
    dark_gray = colors.HexColor("#005F99")
    c.setFillColor(dark_gray)
    c.drawString(margen_izquierdo, y, emisor_ciudad)

    y -= 30
    c.setFont(font_bold, 9)
    c.setFillColor(colors.black)

    label_cliente = "Cliente:"
    c.drawString(margen_izquierdo, y, label_cliente)
    label_width = c.stringWidth(label_cliente, font_bold, 9)
    c.setFont(font_normal, 9)
    c.drawString(margen_izquierdo + label_width + 2, y, nombre_cliente)

    y -= 15
    c.setFont(font_bold, 9)
    label_id = "Identificación:"
    c.drawString(margen_izquierdo, y, label_id)
    label_width = c.stringWidth(label_id, font_bold, 9)
    c.setFont(font_normal, 9)
    c.drawString(margen_izquierdo + label_width + 2, y, identificacion)

    y -= 15
    c.setFont(font_bold, 9)
    label_fecha = "Fecha:"
    c.drawString(margen_izquierdo, y, label_fecha)
    label_width = c.stringWidth(label_fecha, font_bold, 9)
    c.setFont(font_normal, 9)
    c.drawString(margen_izquierdo + label_width + 2, y, fecha)

    y -= 30
    c.setFont(font_bold, 9)
    label_concepto = "Servicio / Proyecto:"
    c.drawString(margen_izquierdo, y, label_concepto)
    label_width = c.stringWidth(label_concepto, font_bold, 9)
    c.setFont(font_normal, 9)
    
    # Usar servicio_proyecto si está disponible, sino usar concepto
    texto_servicio = servicio_proyecto if servicio_proyecto else concepto
    c.drawString(margen_izquierdo + label_width + 2, y, texto_servicio)

    # --- TABLA DE SERVICIOS ---
    col_widths = [250, 30, 120, 100]
    row_height = 30
    table_y_start = y - 40
    header_color = colors.Color(red=0/255, green=95/255, blue=153/255)

    c.setFillColor(header_color)
    c.rect(margen_izquierdo, table_y_start, sum(col_widths), row_height, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont(font_bold, 9)
    headers = ["Descripción", "Cantidad", "Precio Unitario", "Total"]
    for i, header in enumerate(headers):
        c.drawCentredString(margen_izquierdo + sum(col_widths[:i]) + col_widths[i]/2, table_y_start + 6, header)

    current_y, total_general = table_y_start, 0
    c.setFont(font_normal, 9)
    c.setFillColor(colors.black)

    styles = getSampleStyleSheet()

    for servicio in servicios:
        current_y -= row_height
        total_servicio = servicio['precio_unitario'] * servicio['cantidad']
        total_general += total_servicio
        c.setStrokeColorRGB(0.8, 0.8, 0.8)
        c.grid([margen_izquierdo, margen_izquierdo + col_widths[0], margen_izquierdo + sum(col_widths[:2]), margen_izquierdo + sum(col_widths[:3]), margen_izquierdo + sum(col_widths)], [current_y, current_y + row_height])

        # Descripción con wrapping
        desc_style = ParagraphStyle('desc', parent=styles['Normal'], fontName=font_normal, fontSize=9, leading=10)
        desc_p = Paragraph(servicio['descripcion'], desc_style)
        desc_width = col_widths[0] - 20
        w, h = desc_p.wrap(desc_width, row_height - 4)  # leave margin
        desc_y = current_y + 2 + (row_height - 4 - h) / 2
        desc_p.drawOn(c, margen_izquierdo + 10, desc_y)

        text_y = current_y + (row_height / 2) - 3
        c.drawCentredString(margen_izquierdo + col_widths[0] + col_widths[1]/2, text_y, str(servicio['cantidad']))
        c.drawRightString(margen_izquierdo + sum(col_widths[:3]) - 10, text_y, f"$ {servicio['precio_unitario']:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."))
        c.drawRightString(margen_izquierdo + sum(col_widths) - 10, text_y, f"$ {total_servicio:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."))

    current_y -= row_height
    c.grid([margen_izquierdo, margen_izquierdo + sum(col_widths)], [current_y, current_y + row_height])
    c.setFont(font_bold, 10)
    c.drawString(margen_izquierdo + col_widths[0] + col_widths[1] + 10, current_y + 6, "Total General")
    c.drawRightString(margen_izquierdo + sum(col_widths) - 10, current_y + 6, f"$ {total_general:,.2f}".replace(",", "X").replace(".", ",").replace("X", "."))
    y = current_y - 20

    # --- OBSERVACIONES ---
    c.setFont(font_bold, 9)
    c.drawString(margen_izquierdo, y, "Observaciones:")
    y -= 15

    default_text = "No responsable de IVA. Cuenta de cobro emitida bajo el régimen de tributación simplificada."
    if observaciones and observaciones != default_text:
        styles = getSampleStyleSheet()
        observaciones_style = ParagraphStyle(
            'observaciones',
            parent=styles['Normal'],
            fontName=font_normal,
            fontSize=9,
            leading=11
        )
        observaciones_p = Paragraph(observaciones, observaciones_style)
        w, h = observaciones_p.wrap(sum(col_widths), y)
        observaciones_p.drawOn(c, margen_izquierdo, y - h)
        y -= (h + 20)
    else:
        # Show placeholder or concept if no custom observations
        c.setFont(font_normal, 9)
        placeholder_text = concepto if not observaciones or observaciones == default_text else observaciones
        c.drawString(margen_izquierdo, y, placeholder_text)
        y -= 20

    # --- INFORMACIÓN DE PAGO ---
    c.setFont(font_bold, 9)
    c.drawString(margen_izquierdo, y, "Nota:")
    nota_width = c.stringWidth("Nota:", font_bold, 9)
    c.setFont(font_normal, 9)
    c.drawString(margen_izquierdo + nota_width + 2, y, " Se solicita que el pago sea realizado con la mayor brevedad posible")
    y -= 36
    c.setFont(font_normal, 9)
    c.drawString(margen_izquierdo, y, f"Nombre: {emisor_nombre}")
    y -= 12
    c.drawString(margen_izquierdo, y, f"Cédula: {emisor_cedula}")
    y -= 12
    c.drawString(margen_izquierdo, y, f"Cuenta de ahorros Bancolombia: {cuenta_bancolombia}")
    y -= 12
    c.drawString(margen_izquierdo, y, f"Nequi / Daviplata: {nequi}")

    y -= 24
    c.setFont(font_normal, 9)
    c.drawString(margen_izquierdo, y, "Atentamente,")
    y -= 15
    c.drawString(margen_izquierdo, y, "Dairo Tralasviña,")

    c.save()
    return ruta_salida

if __name__ == "__main__":
    import sys
    import json

    # Expects 7 arguments: script_name, nombre_cliente, identificacion, servicios_json, observaciones, concepto, fecha, [servicio_proyecto]
    if len(sys.argv) < 7:
        print("Usage: python generador.py <nombre_cliente> <identificacion> <servicios_json> <observaciones> <concepto> <fecha> [<servicio_proyecto>]")
        sys.exit(1)

    nombre_cliente = sys.argv[1]
    identificacion = sys.argv[2]
    servicios_json = sys.argv[3]
    observaciones = sys.argv[4]
    concepto = sys.argv[5]
    fecha = sys.argv[6]
    servicio_proyecto = sys.argv[7] if len(sys.argv) > 7 else ""

    try:
        servicios = json.loads(servicios_json)
        # Basic validation for servicios structure
        if not isinstance(servicios, list) or not all(isinstance(s, dict) for s in servicios):
            raise ValueError("servicios debe ser una lista de diccionarios.")
        for s in servicios:
            if not all(k in s for k in ['descripcion', 'cantidad', 'precio_unitario']):
                 raise ValueError("Cada servicio debe tener 'descripcion', 'cantidad', y 'precio_unitario'.")

    except (json.JSONDecodeError, ValueError) as e:
        print(f"Error decoding servicios JSON: {e}", file=sys.stderr)
        sys.exit(1)

    try:
        # Call the function with the parsed arguments
        pdf_path = generar_cuenta_de_cobro(
            nombre_cliente,
            identificacion,
            servicios,
            observaciones,
            concepto,
            fecha,
            servicio_proyecto
        )
        # Print the path of the generated PDF to stdout
        print(pdf_path)
    except Exception as e:
        print(f"Error generating PDF: {e}", file=sys.stderr)
        sys.exit(1)
