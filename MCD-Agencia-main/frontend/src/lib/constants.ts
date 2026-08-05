// Constantes de la aplicación basadas en el PRD
export const CONTACT_INFO = {
  whatsapp: {
    number: '+52 744 688 7382',
    url: 'https://wa.me/527446887382',
    displayNumber: '744 688 7382',
  },
  email: 'ventas@agenciamcd.mx',
  businessHours: '9:00 a 18:00',
  location: 'Acapulco, Guerrero',
} as const;

export const LOCATIONS = [
  {
    id: 'acapulco-diamante',
    name: 'Acapulco Diamante',
    city: 'Acapulco, Guerrero',
    address: 'Granjas Márquez Plaza Diamante, C.P. 39890',
    phone: '+52 744 688 7382',
    phoneDisplay: '744 688 7382',
    email: 'ventas@agenciamcd.mx',
    latitude: 16.8001189,
    longitude: -99.8063231,
  },
  {
    id: 'costa-azul',
    name: 'Acapulco Costa Azul',
    city: 'Acapulco, Guerrero',
    address: 'Capitán Vasco de Gama 295, 2° piso Plaza Yamaha, Fracc. Costa Azul, 39850',
    phone: '+52 220 326 9670',
    phoneDisplay: '220 326 9670',
    phone2: '+52 744 443 2745',
    phone2Display: '744 443 2745',
    email: 'ventas3@agenciamcd.mx',
    latitude: 16.8512984,
    longitude: -99.8497261,
  },
  {
    id: 'tecoanapa',
    name: 'Tecoanapa',
    city: 'Tecoanapa, Guerrero',
    address: 'Carretera Federal Tierra Colorada – Ayutla, Col. San Isidro, frente a los Arcos',
    phone: '+52 745 114 7727',
    phoneDisplay: '745 114 7727',
    email: 'ventas2@agenciamcd.mx',
    latitude: 16.9855387,
    longitude: -99.2569781,
  },
] as const;

export const SERVICES = [
  {
    id: 'gran-formato',
    title: 'Impresión en Gran Formato',
    description: 'Impresiones de alta resolución para banners, lonas y más.',
    image: 'https://images.unsplash.com/photo-1504270997636-07ddfbd48945?w=600&q=80',
    useCases: ['Banners', 'Lonas', 'Pósters'],
    icon: '🖨️',
  },
  {
    id: 'diseno-grafico',
    title: 'Diseño Gráfico',
    description: 'Creación de diseños personalizados para tu marca.',
    image: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=600&q=80',
    useCases: ['Logotipos', 'Diseños', 'Branding'],
    icon: '🎨',
  },
  {
    id: 'impresion-uv',
    title: 'Impresiones UV',
    description: 'Impresiones duraderas en diversos materiales.',
    image: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&q=80',
    useCases: ['UV Resistant', 'Durables', 'Materiales'],
    icon: '☀️',
  },
  {
    id: 'rotulacion-digital',
    title: 'Rotulación Digital',
    description: 'Rotulación precisa para vehículos y superficies.',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    useCases: ['Vehículos', 'Superficies', 'Rotulación'],
    icon: '🚗',
  },
  {
    id: 'router-cnc',
    title: 'Servicio Router CNC',
    description: 'Corte preciso para materiales diversos.',
    image: 'https://images.unsplash.com/photo-1504917595217-d4dc5ebb6122?w=600&q=80',
    useCases: ['Corte', 'Precisión', 'Materiales'],
    icon: '⚙️',
  },
  {
    id: 'laser',
    title: 'Corte y Grabado Láser',
    description: 'Detalles finos en madera, acrílico y más.',
    image: 'https://images.unsplash.com/photo-1620287341056-49a2f1ab2fdc?w=600&q=80',
    useCases: ['Madera', 'Acrílico', 'Personalizado'],
    icon: '✨',
  },
  {
    id: 'espectaculares',
    title: 'Espectaculares',
    description: 'Anuncios de gran formato en ubicaciones estratégicas.',
    image: 'https://images.unsplash.com/photo-1563986768494-4dee2763ff3f?w=600&q=80',
    useCases: ['Publicidad', 'Gran Impacto', 'Estratégico'],
    icon: '🏢',
  },
  {
    id: 'vallas-moviles',
    title: 'Vallas Móviles',
    description: 'Publicidad móvil para máxima visibilidad.',
    image: '/images/carousel/vallas-moviles.jfif',
    useCases: ['Móvil', 'Publicidad', 'Impacto'],
    icon: '📱',
  },
  {
    id: 'publibuses',
    title: 'Publibuses',
    description: 'Campañas urbanas en autobuses, camiones y furgonetas con gran impacto visual.',
    image: 'https://images.unsplash.com/photo-1570125909232-eb263c188f7e?w=600&q=80',
    useCases: ['Transporte', 'Urbano', 'Masivo'],
    icon: '🚌',
  },
  {
    id: 'anuncios-iluminados',
    title: 'Fabricación de Anuncios Iluminados',
    description: 'Anuncios personalizados iluminados para tu marca.',
    image: 'https://images.unsplash.com/photo-1557825835-70d97c4aa567?w=600&q=80',
    useCases: ['LED', 'Iluminados', 'Marca'],
    icon: '💡',
  },
  {
    id: 'lonas',
    title: 'Impresión e Instalación de Lonas',
    description: 'Lonas duraderas con instalación profesional.',
    image: 'https://images.unsplash.com/photo-1562577309-4932fdd64cd1?w=600&q=80',
    useCases: ['Instalación', 'Profesional', 'Duraderas'],
    icon: '📐',
  },
  {
    id: 'vinilos',
    title: 'Vinilos & Adhesivos',
    description: 'Decoración de vehículos, vidrieras y superficies con vinilo de alta durabilidad.',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80',
    useCases: ['Vehículos', 'Escaparates', 'Decoración'],
    icon: '🎯',
  },
] as const;

export const HOW_IT_WORKS = [
  {
    step: 1,
    title: 'Cuéntanos qué necesitas',
    description: 'Llena el formulario o escríbenos por WhatsApp',
    icon: '📝',
  },
  {
    step: 2,
    title: 'Cotización en menos de 24h',
    description: 'Te enviamos presupuesto detallado a tu email y WhatsApp',
    icon: '⚡',
  },
  {
    step: 3,
    title: 'Recibe o recoge',
    description: 'Envío a domicilio o recolección en nuestras oficinas',
    icon: '📦',
  },
] as const;

export const FAQ_ITEMS = [
  {
    question: '¿Cuánto tiempo tarda la entrega?',
    answer: 'El tiempo de entrega depende del tipo de proyecto y cantidad. En promedio, lonas y gran formato se entregan en 3-5 días hábiles. Para pedidos urgentes, consúltanos por WhatsApp.',
  },
  {
    question: '¿Hacen envíos fuera de Acapulco?',
    answer: 'Sí, enviamos a toda la República Mexicana. También puedes recoger tu pedido directamente en nuestras oficinas.',
  },
  {
    question: '¿Qué formatos de archivo aceptan?',
    answer: 'Aceptamos PDF, AI, PSD, JPG de alta resolución. Si no cuentas con el archivo adecuado, nuestro equipo de diseño puede ayudarte (costo adicional).',
  },
  {
    question: '¿Puedo solicitar una muestra antes del pedido completo?',
    answer: 'Sí, para pedidos grandes ofrecemos muestras de material y calidad de impresión. Contáctanos para más detalles.',
  },
  {
    question: '¿Ofrecen diseño gráfico?',
    answer: 'Sí, contamos con servicio de diseño. Si no tienes tu arte final, cotiza junto con tu proyecto de impresión.',
  },
  {
    question: '¿Cuáles son las formas de pago?',
    answer: 'Aceptamos transferencia, depósito bancario y pago en efectivo (contra entrega o recolección).',
  },
  {
    question: '¿Qué garantía tienen los trabajos?',
    answer: 'Garantizamos la calidad de impresión y materiales. Si hay un defecto de fabricación, lo reponemos sin costo.',
  },
  {
    question: '¿En qué horario puedo contactarlos?',
    answer: 'Nuestro horario de atención es de 9:00 a 18:00 hrs, de lunes a viernes. Fuera de horario, déjanos tu mensaje y te responderemos al siguiente día hábil.',
  },
] as const;

export const CLIENTS = [
  { name: 'BMW', logo: '/images/clients/BMW.png' },
  { name: 'BYD', logo: '/images/clients/byd.png' },
  { name: 'Carls Jr.', logo: '/images/clients/carls jr.png' },
  { name: 'OMA Aeropuerto', logo: '/images/clients/OMA Aeropuerto.png' },
  { name: 'Interceramic', logo: '/images/clients/interceramic.png' },
  { name: 'JAC Motors', logo: '/images/clients/jacmotors.png' },
  { name: 'Lala', logo: '/images/clients/lala.png' },
  { name: 'Telcel', logo: '/images/clients/telcel.png' },
  { name: 'Toyota', logo: '/images/clients/toyota.png' },
  { name: 'Nutrisa', logo: '/images/clients/nutrisa.png' },
  { name: 'Comex', logo: '/images/clients/comex.png' },
] as const;
