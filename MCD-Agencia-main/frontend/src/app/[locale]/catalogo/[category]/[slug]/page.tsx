'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useLocale } from 'next-intl';
import toast from 'react-hot-toast';
import {
  DocumentTextIcon,
  HeartIcon,
  ShareIcon,
  TruckIcon,
  ShieldCheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';

import { getProductBySlug, ProductVariant } from '@/lib/api/catalog';
import { useCart } from '@/contexts/CartContext';
import { Button, Badge, LoadingPage, Modal } from '@/components/ui';
import { cn } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/sanitize';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const locale = useLocale();
  const { addItem } = useCart();

  const slug = params.slug as string;

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const [showImageModal, setShowImageModal] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const { data: product, isLoading, error } = useQuery({
    queryKey: ['product', slug],
    queryFn: () => getProductBySlug(slug),
  });

  useEffect(() => {
    if (!product?.id) return;
    const raw = localStorage.getItem('savedProducts');
    const saved: string[] = raw ? JSON.parse(raw) : [];
    setIsSaved(saved.includes(product.id));
  }, [product?.id]);

  const matchingVariant = useMemo(() => {
    if (!product?.variants?.length || Object.keys(selectedAttributes).length === 0) {
      return product?.variants?.[0] || null;
    }

    return (
      product.variants.find((variant) =>
        variant.attribute_values.every((av) => {
          const selectedValue = selectedAttributes[av.id];
          return !selectedValue || selectedValue === av.slug;
        })
      ) || null
    );
  }, [product?.variants, selectedAttributes]);

  useMemo(() => {
    if (matchingVariant) {
      setSelectedVariant(matchingVariant);
    }
  }, [matchingVariant]);

  if (isLoading) {
    return <LoadingPage message="Cargando producto..." />;
  }

  if (error || !product) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Producto no encontrado</h1>
          <Link href="/catalogo">
            <Button>Volver al catalogo</Button>
          </Link>
        </div>
      </div>
    );
  }

  const name = locale === 'en' && product.name_en ? product.name_en : product.name;
  const description = locale === 'en' && product.description_en ? product.description_en : product.description;
  const shortDescription =
    locale === 'en' && product.short_description_en
      ? product.short_description_en
      : product.short_description;
  const hasDifferentShortDescription = !!shortDescription && shortDescription.trim().toLowerCase() !== name.trim().toLowerCase();

  const images =
    product.images?.length > 0
      ? product.images
      : [{ id: '0', image: '/images/logo.png', alt_text: name }];

  const nextImage = () => {
    if (images.length > 0) {
      setSelectedImage((prev) => (prev + 1) % images.length);
    }
  };

  const prevImage = () => {
    if (images.length > 0) {
      setSelectedImage((prev) => (prev - 1 + images.length) % images.length);
    }
  };

  const handleBuyNow = async () => {
    const variant = selectedVariant || product.variants?.[0] || null;

    if (!variant) {
      toast.error('Este producto no tiene variante disponible para compra directa');
      return;
    }

    try {
      await addItem(variant.id, 1);
      toast.success('Producto agregado al carrito');
      router.push('/checkout');
    } catch {
      toast.error('No se pudo agregar el producto al carrito');
    }
  };

  const handleAddToCart = async () => {
    const variant = selectedVariant || product.variants?.[0] || null;

    if (!variant) {
      toast.error('Este producto no tiene variante disponible para compra directa');
      return;
    }

    try {
      await addItem(variant.id, quantity);
      toast.success(`Se agregaron ${quantity} unidad(es) al carrito`);
    } catch {
      toast.error('No se pudo agregar el producto al carrito');
    }
  };

  const decreaseQuantity = () => setQuantity((prev) => Math.max(1, prev - 1));
  const increaseQuantity = () => setQuantity((prev) => Math.min(99, prev + 1));
  const onQuantityInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      setQuantity(1);
      return;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return;
    setQuantity(Math.max(1, Math.min(99, parsed)));
  };

  const handleSaveProduct = () => {
    const raw = localStorage.getItem('savedProducts');
    const saved: string[] = raw ? JSON.parse(raw) : [];

    if (saved.includes(product.id)) {
      const updated = saved.filter((id) => id !== product.id);
      localStorage.setItem('savedProducts', JSON.stringify(updated));
      setIsSaved(false);
      toast.success('Producto removido de guardados');
      return;
    }

    const updated = [...saved, product.id];
    localStorage.setItem('savedProducts', JSON.stringify(updated));
    setIsSaved(true);
    toast.success('Producto guardado');
  };

  const handleShareProduct = async () => {
    const shareUrl = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({
          title: name,
          text: hasDifferentShortDescription ? shortDescription : name,
          url: shareUrl,
        });
        return;
      }
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Enlace copiado al portapapeles');
    } catch {
      toast.error('No se pudo compartir este producto');
    }
  };

  return (
    <>
      <div className="min-h-screen pt-20 pb-8 px-4 lg:px-8 flex items-center justify-center">
        <div className="w-full max-w-7xl">
          <div className="flex items-center gap-2 mb-6 text-sm">
            <Link href="/" className="text-neutral-400 hover:text-cyan-400 transition-colors">
              Inicio
            </Link>
            <ChevronRightIcon className="h-4 w-4 text-neutral-600" />
            <Link href="/catalogo" className="text-neutral-400 hover:text-cyan-400 transition-colors">
              Catalogo
            </Link>
            {product.category && (
              <>
                <ChevronRightIcon className="h-4 w-4 text-neutral-600" />
                <Link
                  href={`/catalogo?categoria=${product.category.slug}`}
                  className="text-neutral-400 hover:text-cyan-400 transition-colors"
                >
                  {product.category.name}
                </Link>
              </>
            )}
          </div>

          <div className="border border-neutral-700 rounded-xl bg-neutral-900/50 overflow-hidden">
            <div className="flex flex-col lg:flex-row h-auto">
              <div className="lg:w-2/5 relative h-[350px] md:h-[550px] bg-neutral-800 flex-shrink-0">
                <Image
                  src={images[selectedImage]?.image || '/images/logo.png'}
                  alt={images[selectedImage]?.alt_text || name}
                  fill
                  className="object-contain p-4"
                  priority
                  sizes="(max-width: 768px) 100vw, 40vw"
                />

                <button
                  onClick={() => setShowImageModal(true)}
                  className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center bg-black/50 z-[5]"
                  aria-label="Ver imagen a pantalla completa"
                >
                  <span className="text-white text-xs font-medium">Click para ampliar</span>
                </button>

                {product.is_featured && (
                  <div className="absolute top-3 left-3 z-10">
                    <Badge variant="cyan">Destacado</Badge>
                  </div>
                )}

                {images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors z-10"
                      aria-label="Imagen anterior"
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors z-10"
                      aria-label="Siguiente imagen"
                    >
                      <ChevronRightIcon className="h-4 w-4" />
                    </button>

                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                      {images.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedImage(index)}
                          className={cn(
                            'w-2 h-2 rounded-full transition-all',
                            selectedImage === index ? 'bg-white w-5' : 'bg-white/50 hover:bg-white/70'
                          )}
                          aria-label={`Ver imagen ${index + 1}`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="lg:w-3/5 flex flex-col p-6 overflow-hidden">
                <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                  <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">{name}</h1>

                  <p className="text-neutral-400 text-sm">Categoría: <span className="text-neutral-200">{product.category?.name || 'Sin categoría'}</span></p>

                  {(product.sale_mode === 'QUOTE' || product.sale_mode === 'HYBRID') && (
                    <div className="bg-cmyk-cyan/10 border border-cmyk-cyan/30 rounded-lg p-2.5">
                      <p className="text-xs text-neutral-300">Este producto incluye opcion de cotizacion personalizada.</p>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <div className="flex items-center gap-1.5 text-neutral-400">
                      <TruckIcon className="h-4 w-4 text-yellow-400" />
                      <span className="text-xs">Envio nacional</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-neutral-400">
                      <ShieldCheckIcon className="h-4 w-4 text-cyan-400" />
                      <span className="text-xs">Garantia de calidad</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-neutral-400">Descripción</h4>
                    {hasDifferentShortDescription && <p className="text-neutral-400 text-sm">{shortDescription}</p>}
                    {description ? (
                      <div className="prose prose-invert prose-sm max-w-none prose-p:text-neutral-400 prose-li:text-neutral-400 prose-strong:text-neutral-300">
                        <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(description) }} />
                      </div>
                    ) : (
                      !hasDifferentShortDescription && <p className="text-neutral-400 text-sm">Sin descripción disponible.</p>
                    )}
                  </div>

                  {product.specifications && Object.keys(product.specifications).length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-neutral-200">Especificaciones</h4>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        {Object.entries(product.specifications).map(([key, value]) => (
                          <div key={key} className="flex justify-between gap-2">
                            <dt className="text-neutral-400">{key}:</dt>
                            <dd className="text-neutral-300 font-medium text-right">{String(value)}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-auto border-t border-neutral-700 space-y-3">
                  {(product.sale_mode === 'BUY' || product.sale_mode === 'HYBRID') && product.base_price && (
                    <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-3 space-y-2">
                      {product.compare_at_price && Number(product.compare_at_price) > Number(product.base_price) && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-500 line-through">
                            ${parseFloat(product.compare_at_price).toLocaleString('es-MX')}
                          </span>
                          <Badge variant="success">Oferta</Badge>
                        </div>
                      )}
                      <div className="flex items-baseline justify-between">
                        <span className="text-sm text-neutral-400">Precio:</span>
                        <span className="text-lg font-semibold text-white">
                          ${parseFloat(product.base_price).toLocaleString('es-MX')}
                        </span>
                      </div>
                      <div className="border-t border-neutral-700 pt-2 space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-neutral-400">IVA (16%):</span>
                          <span className="text-neutral-300">
                            ${(parseFloat(product.base_price) * 0.16).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold">
                          <span className="text-neutral-300">Total:</span>
                          <span className="text-cyan-400">
                            ${(parseFloat(product.base_price) * 1.16).toLocaleString('es-MX', { maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {(product.sale_mode === 'BUY' || product.sale_mode === 'HYBRID') && (
                    <div className="space-y-2 mt-2">
                      <div className="grid grid-cols-1 sm:grid-cols-[132px,1fr,1fr] gap-2 items-stretch">
                        <div className="flex items-center rounded-md border border-neutral-600 overflow-hidden h-11 w-[128px]">
                          <button
                            type="button"
                            onClick={decreaseQuantity}
                            className="w-11 text-sm text-white bg-neutral-800 hover:bg-neutral-700 h-full"
                            aria-label="Disminuir cantidad"
                          >
                            -
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={99}
                            value={quantity}
                            onChange={onQuantityInputChange}
                            className="w-[40px] h-full text-sm text-white bg-neutral-900 text-center border-0 outline-none ring-0 shadow-none focus:outline-none focus:ring-0 [appearance:textfield] [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={increaseQuantity}
                            className="w-11 text-sm text-white bg-neutral-800 hover:bg-neutral-700 h-full"
                            aria-label="Aumentar cantidad"
                          >
                            +
                          </button>
                        </div>

                        <Button
                          size="lg"
                          className="w-full font-semibold bg-neutral-700 hover:bg-neutral-600 text-white"
                          onClick={handleAddToCart}
                        >
                          Agregar carrito
                        </Button>
                        <Button
                          size="lg"
                          className="w-full font-semibold bg-green-600 hover:bg-green-700 text-white"
                          onClick={handleBuyNow}
                        >
                          Comprar ahora
                        </Button>
                      </div>
                    </div>
                  )}

                  {(product.sale_mode === 'QUOTE' || product.sale_mode === 'HYBRID') && (
                    <Link href={`/?producto=${product.id}#cotizar`} className="block">
                      <Button
                        size="lg"
                        className="w-full font-semibold bg-cmyk-cyan hover:bg-cmyk-cyan/90 text-white"
                        leftIcon={<DocumentTextIcon className="h-5 w-5" />}
                      >
                        Solicitar cotizacion
                      </Button>
                    </Link>
                  )}

                  <div className="flex gap-2 mt-4 pt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        'flex-1 text-xs border transition-colors',
                        isSaved
                          ? 'text-red-300 border-red-500/40 bg-red-500/10 hover:bg-red-500/20'
                          : 'text-neutral-300 border-neutral-700 hover:bg-neutral-800'
                      )}
                      leftIcon={
                        isSaved
                          ? <HeartIconSolid className="h-4 w-4 text-red-400" />
                          : <HeartIcon className="h-4 w-4" />
                      }
                      onClick={handleSaveProduct}
                    >
                      {isSaved ? 'Guardado' : 'Guardar'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-xs"
                      leftIcon={<ShareIcon className="h-4 w-4" />}
                      onClick={handleShareProduct}
                    >
                      Compartir
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        size="full"
      >
        <div className="relative w-full h-[600px] bg-black flex items-center justify-center">
          <Image
            src={images[selectedImage]?.image || '/images/logo.png'}
            alt={images[selectedImage]?.alt_text || name}
            fill
            className="object-contain p-4"
            priority
            sizes="100vw"
          />

          {images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Imagen anterior"
              >
                <ChevronLeftIcon className="h-6 w-6" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                aria-label="Siguiente imagen"
              >
                <ChevronRightIcon className="h-6 w-6" />
              </button>
            </>
          )}

          {images.length > 1 && (
            <div className="absolute bottom-4 right-4 text-sm text-white bg-black/50 px-3 py-1 rounded">
              {selectedImage + 1} / {images.length}
            </div>
          )}

          {images.length > 1 && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2 flex gap-2 overflow-x-auto justify-center">
              {images.map((img, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={cn(
                    'relative flex-shrink-0 w-16 h-16 rounded overflow-hidden transition-all',
                    selectedImage === index ? 'ring-2 ring-cyan-400 opacity-100' : 'opacity-50 hover:opacity-75'
                  )}
                >
                  <Image
                    src={img.image}
                    alt={`Miniatura ${index + 1}`}
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
