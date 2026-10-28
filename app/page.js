import { preload } from 'react-dom';
import { getManifest, introTextures } from '../lib/photos';
import Site from '../components/Site';

export default async function Page() {
  const manifest = await getManifest();
  // The collage's photos start downloading with the page itself, instead of
  // waiting for the 3D code to arrive and ask for them.
  introTextures(manifest).forEach((url) => preload(url, { as: 'image', crossOrigin: 'anonymous', fetchPriority: 'high' }));
  return <Site manifest={manifest} />;
}
