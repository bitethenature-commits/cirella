import sharp from "sharp";
import { processImage } from "../../lib/images";
import { eq, ok, test, throws } from "./harness";

/** Foto de móvil de prueba: 3000×2000, girada (EXIF Orientation 6) y con la ubicación GPS. */
async function phonePhoto(width = 3000, height = 2000) {
  return sharp({ create: { width, height, channels: 3, background: { r: 180, g: 120, b: 200 } } })
    .jpeg({ quality: 90 })
    .withMetadata({ orientation: 6 })
    .withExif({ IFD0: { Make: "TelefonoDePrueba" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "40/1 25/1 0/1" } })
    .toBuffer();
}

test("la foto de prueba lleva EXIF (comprobación del propio test)", async () => {
  const photo = await phonePhoto();
  const meta = await sharp(photo).metadata();
  eq(meta.orientation, 6);
  ok(meta.exif?.length, "sin EXIF");
  ok(photo.includes(Buffer.from("TelefonoDePrueba")), "sin marca del móvil");
});

test("processImage endereza, limita a 1600 px, pasa a WebP y quita EXIF/GPS", async () => {
  const img = await processImage(await phonePhoto());
  const meta = await sharp(img.main).metadata();
  eq(meta.format, "webp");
  // Orientation 6 = girada 90°: el resultado es vertical
  ok(img.height > img.width, `${img.width}×${img.height} no es vertical`);
  eq(Math.max(img.width, img.height), 1600);
  eq([meta.width, meta.height], [img.width, img.height]);
  eq(meta.exif, undefined);
  eq(meta.xmp, undefined);
  eq(meta.orientation, undefined);
  ok(!img.main.includes(Buffer.from("Exif")) && !img.main.includes(Buffer.from("TelefonoDePrueba")), "quedan restos de EXIF");
  ok(img.main.length < 400 * 1024, `pesa ${img.main.length} bytes`);
});

test("processImage genera las variantes de 400, 800 y 1200 px", async () => {
  const img = await processImage(await phonePhoto());
  eq(img.variants.map((v) => v.width), [400, 800, 1200]);
  for (const v of img.variants) {
    const meta = await sharp(v.data).metadata();
    eq(meta.format, "webp");
    eq(meta.width, v.width);
    eq(meta.exif, undefined);
  }
});

test("processImage no amplía una imagen pequeña", async () => {
  const small = await sharp({ create: { width: 300, height: 200, channels: 3, background: "#ccc" } }).png().toBuffer();
  const img = await processImage(small);
  eq([img.width, img.height], [300, 200]);
  for (const v of img.variants) eq((await sharp(v.data).metadata()).width, 300);
});

test("processImage: un archivo que no es una imagen da un error en español", () =>
  throws(() => processImage(Buffer.from("esto no es una imagen")), /No hemos podido leer la imagen/));

test("processImage: un JPEG cortado da un error en español", async () => {
  const jpeg = await phonePhoto(800, 600);
  await throws(() => processImage(jpeg.subarray(0, Math.floor(jpeg.length / 3))), /No hemos podido leer la imagen/);
});
