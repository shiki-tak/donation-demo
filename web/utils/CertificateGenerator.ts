import { createCanvas, registerFont, Canvas } from 'canvas';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

function registerCustomFonts() {
  console.log(process.cwd());
  const fontsToRegister = [
    { path: 'GreatVibes-Regular.ttf', family: 'GreatVibes' },
    { path: 'Roboto-Light.ttf', family: 'Roboto', weight: '300' },
    { path: 'Roboto-Regular.ttf', family: 'Roboto', weight: '400' }
  ];

  for (const font of fontsToRegister) {
    const fontPath = path.join(process.cwd(), 'public', 'fonts', font.path);
    try {
      registerFont(fontPath, { 
        family: font.family, 
        weight: font.weight,
        style: 'normal'
      });
      console.log(`Registered font: ${font.family} ${font.weight || ''}`);
    } catch (error) {
      console.error(`Error registering font ${font.path}:`, error);
    }
  }
}
async function GenerateCertificateBase64(donor: string, projectId: string, amount: string, tokenId: string): Promise<string> {
  registerCustomFonts();

  const canvas: Canvas = createCanvas(600, 900);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, 600, 900);

  // Subtle background pattern
  ctx.fillStyle = '#F8F8F8';
  for (let i = 0; i < 600; i += 20) {
    for (let j = 0; j < 900; j += 20) {
      ctx.fillRect(i, j, 10, 10);
    }
  }

  // Title with calligraphy font
  ctx.font = '48px GreatVibes';
  ctx.fillStyle = '#333333';
  ctx.textAlign = 'center';
  ctx.fillText('Certificate of Donation', 300, 100);

  // Thin decorative line
  ctx.beginPath();
  ctx.moveTo(100, 130);
  ctx.lineTo(500, 130);
  ctx.strokeStyle = '#999999';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Content
  ctx.font = '24px Roboto-Light';
  ctx.fillStyle = '#555555';
  ctx.fillText('This is to certify that', 300, 200);

  ctx.font = '18px Roboto-Regular';
  ctx.fillStyle = '#333333';
  ctx.fillText(donor, 300, 250);

  ctx.font = '24px Roboto-Light';
  ctx.fillStyle = '#555555';
  ctx.fillText('has generously donated', 300, 300);

  ctx.font = '32px Roboto-Regular';
  ctx.fillStyle = '#333333';
  ctx.fillText(`${amount} KAIA`, 300, 350);

  ctx.font = '24px Roboto-Light';
  ctx.fillStyle = '#555555';
  ctx.fillText(`to Project ID: ${projectId}`, 300, 400);

  // Minimalist decorative element
  ctx.beginPath();
  ctx.arc(300, 500, 50, 0, Math.PI * 2);
  ctx.strokeStyle = '#999999';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.font = '24px Roboto-Light';
  ctx.fillStyle = '#333333';
  ctx.fillText('Thanks!', 300, 508);

  // Certificate ID and Date
  ctx.font = '16px Roboto-Light';
  ctx.fillStyle = '#777777';
  ctx.textAlign = 'left';
  ctx.fillText(`Certificate ID: ${tokenId}`, 50, 800);

  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  ctx.textAlign = 'right';
  ctx.fillText(`Issue Date: ${date}`, 550, 800);

  // Subtle border
  ctx.strokeStyle = '#DDDDDD';
  ctx.lineWidth = 2;
  ctx.strokeRect(20, 20, 560, 860);

  // Convert canvas to Base64 encoded string
  return canvas.toDataURL('image/png').split(',')[1];
}

export default GenerateCertificateBase64
