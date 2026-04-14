export default function supabaseLoader({ 
  src, 
  _width, 
  _quality 
}: { 
  src: string; 
  _width: number; 
  _quality?: number 
}) {
  // Only optimize Supabase storage URLs
  // NOTE: Supabase Image Transformation is a PAID feature. 
  // Returning original src for compatibility with Free Plan.
  /*
  if (supabaseUrl && src.includes(supabaseUrl)) {
    const relativePath = src.replace(`${supabaseUrl}/storage/v1/object/public/`, '');
    const searchParams = new URLSearchParams();
    searchParams.set('width', width.toString());
    searchParams.set('quality', (quality || 75).toString());
    searchParams.set('resize', 'contain');
    
    return `${supabaseUrl}/storage/v1/render/image/public/${relativePath}?${searchParams.toString()}`;
  }
  */
  
  return src;
}
