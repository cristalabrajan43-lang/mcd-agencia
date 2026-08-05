'use client';

import { Modal } from '@/components/ui/Modal';
import { useLegalModal } from '@/contexts/LegalModalContext';

/* ════════════════════════════════════════════════════════════════════════════
   Privacy Notice Content
   ════════════════════════════════════════════════════════════════════════ */

function PrivacyContent() {
  return (
    <article className="prose prose-invert prose-sm sm:prose-base mx-auto space-y-6">
      <p className="text-xs text-neutral-400">
        Última actualización: 8 de febrero de 2026
      </p>

      {/* 1 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          1. Identidad del responsable
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          <strong className="text-white">Agencia MCD</strong> (en adelante
          &quot;nosotros&quot; o &quot;la Empresa&quot;), con domicilio en
          Acapulco, Guerrero, México, es responsable de la recopilación, uso y
          protección de sus datos personales conforme a la Ley Federal de
          Protección de Datos Personales en Posesión de los Particulares
          (LFPDPPP) y demás normativa aplicable.
        </p>
      </section>

      {/* 2 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          2. Datos personales que recopilamos
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          Dependiendo de su interacción con nuestro sitio, podemos recopilar:
        </p>
        <ul className="list-disc pl-6 text-neutral-300 space-y-1">
          <li><strong className="text-white">Datos de identificación:</strong> nombre, correo electrónico, teléfono, empresa.</li>
          <li><strong className="text-white">Datos de cuenta:</strong> contraseña (encriptada), rol de usuario.</li>
          <li><strong className="text-white">Datos de transacción:</strong> productos cotizados, pedidos, historial de compras.</li>
          <li><strong className="text-white">Datos de navegación:</strong> dirección IP, tipo de dispositivo, sistema operativo, navegador, páginas visitadas, tiempo en el sitio, profundidad de scroll.</li>
          <li><strong className="text-white">Datos de marketing:</strong> fuente de tráfico (UTM), interacciones con anuncios.</li>
        </ul>
      </section>

      {/* 3 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          3. Finalidades del tratamiento
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          Sus datos se utilizarán para:
        </p>
        <ul className="list-disc pl-6 text-neutral-300 space-y-1">
          <li>Procesar cotizaciones y pedidos.</li>
          <li>Crear y administrar su cuenta de usuario.</li>
          <li>Enviar notificaciones sobre el estado de sus solicitudes.</li>
          <li>Mejorar nuestro sitio web mediante análisis de uso (Google Analytics, Microsoft Clarity).</li>
          <li>Mostrar publicidad relevante (Facebook Pixel, Google Ads), solo con su consentimiento.</li>
          <li>Cumplir con obligaciones legales.</li>
        </ul>
      </section>

      {/* 4 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          4. Uso de cookies y tecnologías de rastreo
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          Utilizamos los siguientes tipos de cookies:
        </p>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border border-neutral-700">
            <thead>
              <tr className="bg-neutral-800">
                <th className="text-left px-3 py-2 text-white font-semibold">Tipo</th>
                <th className="text-left px-3 py-2 text-white font-semibold">Finalidad</th>
                <th className="text-left px-3 py-2 text-white font-semibold">¿Requiere consentimiento?</th>
              </tr>
            </thead>
            <tbody className="text-neutral-300 divide-y divide-neutral-700">
              <tr>
                <td className="px-3 py-2 font-medium text-white">Esenciales</td>
                <td className="px-3 py-2">Sesión, carrito de compras, idioma, seguridad</td>
                <td className="px-3 py-2">No (necesarias para el funcionamiento)</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium text-white">Analíticas</td>
                <td className="px-3 py-2">Google Analytics 4, Microsoft Clarity — medir uso del sitio, mapas de calor, grabaciones de sesión</td>
                <td className="px-3 py-2">Sí</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium text-white">Marketing</td>
                <td className="px-3 py-2">Facebook Pixel, Google Ads — remarketing y anuncios personalizados</td>
                <td className="px-3 py-2">Sí</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-neutral-300 leading-relaxed">
          Al visitar nuestro sitio por primera vez, verá un banner de cookies donde
          podrá: aceptar todas, rechazar las no esenciales, o personalizar su
          elección. Puede cambiar sus preferencias en cualquier momento haciendo
          clic en &quot;Preferencias de cookies&quot; en el pie de página.
        </p>
      </section>

      {/* 5 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          5. Transferencias a terceros
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          Podemos compartir datos con:
        </p>
        <ul className="list-disc pl-6 text-neutral-300 space-y-1">
          <li><strong className="text-white">Google LLC</strong> — Analytics y Ads (EE.UU.).</li>
          <li><strong className="text-white">Microsoft Corporation</strong> — Clarity (EE.UU.).</li>
          <li><strong className="text-white">Meta Platforms</strong> — Facebook Pixel (EE.UU.).</li>
          <li><strong className="text-white">Proveedores de pago</strong> — para procesar transacciones.</li>
        </ul>
        <p className="text-neutral-300 leading-relaxed">
          Estas transferencias se realizan conforme al art.&nbsp;36 de la LFPDPPP y
          los términos de privacidad de cada proveedor.
        </p>
      </section>

      {/* 6 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          6. Derechos ARCO
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          Usted tiene derecho a <strong className="text-white">Acceder</strong>,{' '}
          <strong className="text-white">Rectificar</strong>,{' '}
          <strong className="text-white">Cancelar</strong> u{' '}
          <strong className="text-white">Oponerse</strong> al tratamiento de sus
          datos personales (Derechos ARCO). Para ejercer estos derechos, envíe un
          correo a{' '}
          <a href="mailto:privacidad@agenciamcd.com" className="text-cmyk-cyan hover:underline">
            privacidad@agenciamcd.com
          </a>{' '}
          indicando su nombre completo, descripción de la solicitud y una copia de
          su identificación oficial. Responderemos en un plazo máximo de 20 días
          hábiles.
        </p>
      </section>

      {/* 7 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          7. Medidas de seguridad
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          Implementamos medidas administrativas, técnicas y físicas para proteger
          sus datos, incluyendo: cifrado HTTPS/TLS, contraseñas hasheadas, control
          de acceso basado en roles, y registros de auditoría.
        </p>
      </section>

      {/* 8 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          8. Cambios al aviso de privacidad
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          Nos reservamos el derecho de modificar este aviso. Las actualizaciones se
          publicarán en esta página con su nueva fecha de vigencia. Si los cambios
          son significativos, le solicitaremos nuevamente su consentimiento para
          cookies analíticas y de marketing.
        </p>
      </section>

      {/* 9 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          9. Contacto
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          Si tiene dudas sobre este aviso de privacidad, contáctenos:
        </p>
        <ul className="list-disc pl-6 text-neutral-300 space-y-1">
          <li>Correo: <a href="mailto:privacidad@agenciamcd.com" className="text-cmyk-cyan hover:underline">privacidad@agenciamcd.com</a></li>
          <li>WhatsApp: <a href="https://wa.me/527441234567" className="text-cmyk-cyan hover:underline">+52 744 123 4567</a></li>
        </ul>
      </section>
    </article>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Terms & Conditions Content
   ════════════════════════════════════════════════════════════════════════ */

function TermsContent() {
  return (
    <article className="prose prose-invert prose-sm sm:prose-base mx-auto space-y-6">
      <p className="text-xs text-neutral-400">
        Última actualización: 8 de febrero de 2026
      </p>

      {/* 1 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          1. Aceptación de los términos
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          Al acceder y utilizar el sitio web de{' '}
          <strong className="text-white">Agencia MCD</strong> (en adelante
          &quot;el Sitio&quot;), usted acepta cumplir con los presentes Términos y
          Condiciones. Si no está de acuerdo con alguno de estos términos, le
          solicitamos no hacer uso del Sitio.
        </p>
      </section>

      {/* 2 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          2. Descripción del servicio
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          Agencia MCD ofrece servicios de impresión en gran formato, señalética,
          rotulación, publicidad exterior y diseño gráfico. A través del Sitio,
          los usuarios pueden:
        </p>
        <ul className="list-disc pl-6 text-neutral-300 space-y-1">
          <li>Consultar nuestro catálogo de productos y servicios.</li>
          <li>Solicitar cotizaciones personalizadas.</li>
          <li>Realizar pedidos en línea.</li>
          <li>Gestionar su cuenta de usuario.</li>
          <li>Comunicarse con nuestro equipo a través del chat integrado.</li>
        </ul>
      </section>

      {/* 3 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          3. Registro y cuenta de usuario
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          Para acceder a determinadas funcionalidades, deberá crear una cuenta
          proporcionando información veraz y actualizada. Usted es responsable de
          mantener la confidencialidad de su contraseña y de las actividades que se
          realicen bajo su cuenta. Agencia MCD se reserva el derecho de suspender
          o cancelar cuentas que infrinjan estos términos.
        </p>
      </section>

      {/* 4 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          4. Cotizaciones y pedidos
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          Las cotizaciones generadas a través del Sitio tienen una vigencia de
          15&nbsp;días naturales a partir de su fecha de emisión, salvo que se
          indique lo contrario. Los precios incluyen IVA cuando se señala
          expresamente. Una vez confirmado el pedido y realizado el pago (o
          anticipo), se considerará como un compromiso de compra.
        </p>
      </section>

      {/* 5 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          5. Precios y formas de pago
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          Los precios publicados están sujetos a cambio sin previo aviso.
          Aceptamos los siguientes métodos de pago:
        </p>
        <ul className="list-disc pl-6 text-neutral-300 space-y-1">
          <li>Transferencia bancaria / SPEI.</li>
          <li>Tarjeta de débito o crédito (a través de pasarelas de pago seguras).</li>
          <li>Pago en efectivo en nuestras sucursales.</li>
        </ul>
        <p className="text-neutral-300 leading-relaxed">
          Para pedidos personalizados o de gran volumen, podrá requerirse un
          anticipo del 50&nbsp;% para iniciar la producción.
        </p>
      </section>

      {/* 6 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          6. Tiempos de entrega
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          Los tiempos de entrega son estimados y dependen del tipo de producto,
          volumen del pedido y la disponibilidad de materiales. Agencia MCD hará
          su mejor esfuerzo por cumplir con los plazos indicados, pero no será
          responsable por retrasos causados por fuerza mayor, condiciones
          climáticas o problemas en la cadena de suministro.
        </p>
      </section>

      {/* 7 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          7. Cancelaciones y devoluciones
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          Debido a la naturaleza personalizada de nuestros productos, las
          cancelaciones solo se aceptarán antes de que inicie el proceso de
          producción. No se aceptan devoluciones en productos personalizados,
          salvo que presenten defectos de fabricación verificables. En caso de
          defecto, deberá notificarnos dentro de las 48&nbsp;horas posteriores a
          la recepción del producto.
        </p>
      </section>

      {/* 8 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          8. Propiedad intelectual
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          Todo el contenido del Sitio (textos, imágenes, logotipos, diseños,
          código fuente) es propiedad de Agencia MCD o de sus licenciantes y está
          protegido por las leyes de propiedad intelectual aplicables. Queda
          prohibida su reproducción, distribución o modificación sin autorización
          previa por escrito.
        </p>
      </section>

      {/* 9 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          9. Archivos proporcionados por el cliente
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          El usuario garantiza que los archivos, imágenes y diseños que envíe
          para producción son de su propiedad o cuenta con los derechos
          necesarios para su uso. Agencia MCD no será responsable por
          infracciones de derechos de autor derivadas del material proporcionado
          por el cliente.
        </p>
      </section>

      {/* 10 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          10. Limitación de responsabilidad
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          Agencia MCD no será responsable por daños indirectos, incidentales o
          consecuentes derivados del uso del Sitio. La responsabilidad máxima se
          limitará al monto pagado por el usuario en la transacción
          correspondiente. El Sitio se proporciona &quot;tal cual&quot;, sin
          garantías de disponibilidad ininterrumpida.
        </p>
      </section>

      {/* 11 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          11. Legislación aplicable y jurisdicción
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          Estos Términos y Condiciones se rigen por las leyes de los Estados
          Unidos Mexicanos. Para cualquier controversia, las partes se someten a
          la jurisdicción de los tribunales competentes de Acapulco, Guerrero,
          renunciando a cualquier otro fuero que pudiera corresponderles.
        </p>
      </section>

      {/* 12 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          12. Modificaciones
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          Agencia MCD se reserva el derecho de modificar estos Términos y
          Condiciones en cualquier momento. Los cambios entrarán en vigor a
          partir de su publicación en el Sitio. El uso continuado del Sitio
          constituye la aceptación de los términos actualizados.
        </p>
      </section>

      {/* 13 */}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-cmyk-cyan">
          13. Contacto
        </h2>
        <p className="text-neutral-300 leading-relaxed">
          Para cualquier duda relacionada con estos Términos y Condiciones:
        </p>
        <ul className="list-disc pl-6 text-neutral-300 space-y-1">
          <li>Correo: <a href="mailto:contacto@agenciamcd.com" className="text-cmyk-cyan hover:underline">contacto@agenciamcd.com</a></li>
          <li>WhatsApp: <a href="https://wa.me/527441234567" className="text-cmyk-cyan hover:underline">+52 744 123 4567</a></li>
        </ul>
      </section>
    </article>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   Legal Modal (renders whichever type is active)
   ════════════════════════════════════════════════════════════════════════ */

export function LegalModal() {
  const { activeModal, closeModal } = useLegalModal();

  return (
    <>
      {/* Privacy modal */}
      <Modal
        isOpen={activeModal === 'privacy'}
        onClose={closeModal}
        title="Aviso de Privacidad"
        size="full"
      >
        <PrivacyContent />
      </Modal>

      {/* Terms modal */}
      <Modal
        isOpen={activeModal === 'terms'}
        onClose={closeModal}
        title="Términos y Condiciones"
        size="full"
      >
        <TermsContent />
      </Modal>
    </>
  );
}
