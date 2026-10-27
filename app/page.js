import { getManifest } from '../lib/photos';
import Site from '../components/Site';

export default async function Page() {
  const manifest = await getManifest();
  return <Site manifest={manifest} />;
}
