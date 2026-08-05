'use client';

/**
 * TestimonialsSection Component for MCD-Agencia.
 *
 * Displays client testimonials in a carousel format.
 * Features auto-play and bilingual support.
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { StarIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/solid';

interface Testimonial {
  id: string;
  author_name: string;
  author_title: string;
  author_company: string;
  content: string;
  content_en: string;
  photo?: string;
  rating?: number;
}

interface TestimonialsSectionProps {
  testimonials: Testimonial[];
}

export default function TestimonialsSection({ testimonials }: TestimonialsSectionProps) {
  const t = useTranslations('Testimonials');
  const locale = useLocale();
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  }, [testimonials.length]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  }, [testimonials.length]);

  // Auto-play
  useEffect(() => {
    if (testimonials.length <= 1) return;
    const interval = setInterval(nextSlide, 6000);
    return () => clearInterval(interval);
  }, [nextSlide, testimonials.length]);

  if (!testimonials || testimonials.length === 0) {
    return null;
  }

  const currentTestimonial = testimonials[currentIndex];
  const content = locale === 'en' && currentTestimonial.content_en
    ? currentTestimonial.content_en
    : currentTestimonial.content;

  return (
    <section className="py-16 md:py-24 bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            {t('title')}
          </h2>
          <p className="text-lg text-gray-300">
            {t('subtitle')}
          </p>
        </motion.div>

        {/* Testimonial Card */}
        <div className="relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              className="bg-white rounded-2xl p-8 md:p-12 shadow-xl"
            >
              {/* Quote Icon */}
              <div className="absolute -top-6 left-8">
                <div className="w-12 h-12 bg-cmyk-cyan rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
                  </svg>
                </div>
              </div>

              {/* Rating */}
              {currentTestimonial.rating && (
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <StarIcon
                      key={i}
                      className={`h-5 w-5 ${
                        i < currentTestimonial.rating!
                          ? 'text-yellow-400'
                          : 'text-gray-200'
                      }`}
                    />
                  ))}
                </div>
              )}

              {/* Content */}
              <blockquote className="text-xl md:text-2xl text-gray-700 italic mb-8">
                "{content}"
              </blockquote>

              {/* Author */}
              <div className="flex items-center gap-4">
                {currentTestimonial.photo ? (
                  <div className="relative w-14 h-14 rounded-full overflow-hidden">
                    <Image
                      src={currentTestimonial.photo}
                      alt={currentTestimonial.author_name}
                      fill
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-cyan-500 to-magenta-500 flex items-center justify-center text-white text-xl font-bold">
                    {currentTestimonial.author_name.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-gray-900">
                    {currentTestimonial.author_name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {currentTestimonial.author_title}
                    {currentTestimonial.author_company && (
                      <span> · {currentTestimonial.author_company}</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation Arrows */}
          {testimonials.length > 1 && (
            <>
              <button
                onClick={prevSlide}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 md:-translate-x-6 p-2 rounded-full bg-white shadow-lg hover:bg-gray-50 transition-colors"
                aria-label="Previous testimonial"
              >
                <ChevronLeftIcon className="h-6 w-6 text-gray-600" />
              </button>
              <button
                onClick={nextSlide}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 md:translate-x-6 p-2 rounded-full bg-white shadow-lg hover:bg-gray-50 transition-colors"
                aria-label="Next testimonial"
              >
                <ChevronRightIcon className="h-6 w-6 text-gray-600" />
              </button>
            </>
          )}
        </div>

        {/* Dots */}
        {testimonials.length > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {testimonials.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? 'bg-cmyk-cyan w-6'
                    : 'bg-white/30 hover:bg-white/50'
                }`}
                aria-label={`Go to testimonial ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
