import React, { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { optimizedImageUrl } from '../../lib/supabaseImageUrl'
import { cn } from '../ui/utils'

const ERROR_IMG_SRC =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODgiIGhlaWdodD0iODgiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgc3Ryb2tlPSIjMDAwIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBvcGFjaXR5PSIuMyIgZmlsbD0ibm9uZSIgc3Ryb2tlLXdpZHRoPSIzLjciPjxyZWN0IHg9IjE2IiB5PSIxNiIgd2lkdGg9IjU2IiBoZWlnaHQ9IjU2IiByeD0iNiIvPjxwYXRoIGQ9Im0xNiA1OCAxNi0xOCAzMiAzMiIvPjxjaXJjbGUgY3g9IjUzIiBjeT0iMzUiIHI9IjciLz48L3N2Zz4KCg=='

type Props = React.ImgHTMLAttributes<HTMLImageElement> & {
  /**
   * Ancho objetivo (px) para pedir la imagen ya redimensionada/comprimida vía el
   * endpoint de transformación de Supabase Storage. No afecta el `width` nativo del
   * `<img>` (layout); solo el recurso que se descarga. Sin efecto en URLs que no son
   * de Supabase Storage (p. ej. el CDN de Tokko).
   */
  optimizeWidth?: number
  optimizeQuality?: number
  /**
   * Muestra un indicador visual de carga (spinner) mientras la imagen se está descargando,
   * proporcionando retroalimentación clara al cambiar de foto en galerías y lightbox.
   */
  showLoadingSpinner?: boolean
}

export function ImageWithFallback(props: Props) {
  const [didError, setDidError] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  const {
    src,
    alt,
    style,
    className,
    loading,
    optimizeWidth,
    optimizeQuality,
    showLoadingSpinner,
    onLoad,
    onError,
    ...rest
  } = props

  const resolvedSrc = optimizeWidth
    ? optimizedImageUrl(src, { width: optimizeWidth, quality: optimizeQuality })
    : src

  useEffect(() => {
    setDidError(false)
    setIsLoaded(false)
  }, [resolvedSrc])

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setIsLoaded(true)
    if (onLoad) onLoad(e)
  }

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setDidError(true)
    setIsLoaded(true)
    if (onError) onError(e)
  }

  if (didError) {
    return (
      <div
        className={cn('inline-block bg-gray-100 text-center align-middle', className)}
        style={style}
      >
        <div className="flex items-center justify-center w-full h-full min-h-[150px]">
          <img src={ERROR_IMG_SRC} alt="Error loading image" {...rest} data-original-url={src} />
        </div>
      </div>
    )
  }

  if (showLoadingSpinner) {
    return (
      <div className={cn('relative overflow-hidden flex items-center justify-center', className)} style={style}>
        {!isLoaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/40 backdrop-blur-[2px] rounded-lg transition-opacity duration-200 pointer-events-none">
            <Loader2 className="w-8 h-8 animate-spin text-white/90 mb-2 drop-shadow" />
            <span className="text-xs font-mono text-white/80 tracking-wider drop-shadow">Cargando...</span>
          </div>
        )}
        <img
          key={resolvedSrc}
          src={resolvedSrc}
          alt={alt}
          className={cn(
            'w-full h-full object-contain transition-opacity duration-300',
            isLoaded ? 'opacity-100' : 'opacity-20'
          )}
          loading={loading ?? 'lazy'}
          decoding="async"
          {...rest}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
      </div>
    )
  }

  return (
    <img
      key={resolvedSrc}
      src={resolvedSrc}
      alt={alt}
      className={className}
      style={style}
      loading={loading ?? 'lazy'}
      decoding="async"
      {...rest}
      onLoad={handleImageLoad}
      onError={handleImageError}
    />
  )
}

