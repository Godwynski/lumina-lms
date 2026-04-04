export default function supabaseLoader({ 
  src, 
  width, 
  quality 
}: { 
  src: string; 
  width: number; 
  quality?: number 
}) {
  const supabaseUrl = 'https://lvifzwbafxpopzcgdvtt.supabase.co';
  
  // Only optimize Supabase storage URLs
  if (src.includes(supabaseUrl)) {
    // Convert object/public URLs to render/image/public URLs
    // From: https://.../storage/v1/object/public/covers/my-image.jpg
    // To: https://.../storage/v1/render/image/public/covers/my-image.jpg
    const relativePath = src.replace(`${supabaseUrl}/storage/v1/object/public/`, '');
    const searchParams = new URLSearchParams();
    searchParams.set('width', width.toString());
    searchParams.set('quality', (quality || 75).toString());
    searchParams.set('resize', 'contain');
    
    return `${supabaseUrl}/storage/v1/render/image/public/${relativePath}?${searchParams.toString()}`;
  }
  
  // Return the original URL for external sources (Google Books, OpenLibrary)
  return src;
}
