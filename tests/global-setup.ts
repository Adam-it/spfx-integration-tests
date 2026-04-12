import { globalAuthSetup } from './helpers/auth';
import path from 'path';
import fs from 'fs';

async function globalSetup() {
  const pageUrl = process.env.PAGE_URL;
  if (!pageUrl) {
    throw new Error('PAGE_URL environment variable must be set');
  }

  const authDir = path.join(__dirname, '..', '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  const storageStatePath = path.join(authDir, 'user.json');
  
  console.log('Performing global authentication setup...');
  await globalAuthSetup(pageUrl, storageStatePath);
  console.log('Authentication setup complete.');
}

export default globalSetup;
