// Optimized Cloudinary URLs for MooCuan logo
// Uses WebP format, auto quality, and proper sizing to reduce bandwidth

const CLOUDINARY_BASE = "https://res.cloudinary.com/drvu0dpry/image/upload";
const LOGO_ID = "v1764410228/moocuan-logo_ya5ous";

// Helper to generate optimized Cloudinary URL
export const getOptimizedLogoUrl = (width: number, height?: number): string => {
  const h = height || width;
  // f_auto: auto format (WebP/AVIF where supported)
  // q_auto: auto quality optimization
  // w_X,h_Y: resize to exact dimensions
  // c_fit: fit within dimensions maintaining aspect ratio
  return `${CLOUDINARY_BASE}/f_auto,q_auto,w_${width},h_${h},c_fit/${LOGO_ID}`;
};

// Pre-defined sizes for common use cases
export const LOGO_SIZES = {
  // Navbar/Header (small)
  sm: getOptimizedLogoUrl(40),
  smRetina: getOptimizedLogoUrl(80),
  
  // Medium displays
  md: getOptimizedLogoUrl(64),
  mdRetina: getOptimizedLogoUrl(128),
  
  // Large displays (spinner, hero)
  lg: getOptimizedLogoUrl(160),
  lgRetina: getOptimizedLogoUrl(320),
  
  // PWA icons
  icon192: getOptimizedLogoUrl(192),
  icon512: getOptimizedLogoUrl(512),
  
  // Favicons
  favicon16: getOptimizedLogoUrl(16),
  favicon32: getOptimizedLogoUrl(32),
  favicon144: getOptimizedLogoUrl(144),
  favicon180: getOptimizedLogoUrl(180),
  
  // Social sharing (OG/Twitter)
  social: `${CLOUDINARY_BASE}/f_auto,q_auto,w_1200,h_630,c_pad,b_rgb:0a0a0a/${LOGO_ID}`,
};

// Default export for backwards compatibility
export const MOOCUAN_LOGO = LOGO_SIZES.lg;

export default MOOCUAN_LOGO;
