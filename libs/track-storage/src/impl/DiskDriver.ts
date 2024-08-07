import {
  PathLike,
  existsSync,
  mkdirSync,
  createReadStream,
  createWriteStream,
} from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { pipeline } from 'node:stream/promises';
import { PassThrough, Readable } from 'node:stream';
// import { FiLE_EXTENSIONS } from './constants';

export interface DiskDriverOptions {
  downloadedTracksPath: string;
  convertedTracksPath: string;
}
export class DiskDriver {
  private downloadedTracksPath: string;
  private convertedTracksPath: string;

  constructor({
    downloadedTracksPath,
    convertedTracksPath,
  }: DiskDriverOptions) {
    this.downloadedTracksPath = downloadedTracksPath;
    this.convertedTracksPath = convertedTracksPath;
    this.createPathIfNotExist(downloadedTracksPath);
    this.createPathIfNotExist(convertedTracksPath);
  }

  private createPathIfNotExist(path: PathLike) {
    try {
      if (!existsSync(path)) {
        mkdirSync(path, { recursive: true });
      }
    } catch (err) {
      console.error(err);
    }
  }

  saveBufferToDisk(
    buffer: Buffer,
    uri: string,
    location: string,
    fileExtension: string,
  ) {
    const path = this.getPath(uri, location, fileExtension);

    return writeFile(path, buffer, 'utf-8');
  }

  saveStreamToDisk(
    stream: Readable | PassThrough,
    uri: string,
    location: string,
    fileExtension: string,
  ) {
    const path = this.getPath(uri, location, fileExtension);
    const writeStream = createWriteStream(path, {
      encoding: 'utf-8',
    });

    return pipeline(stream, writeStream);
  }

  getStreamFromDisk(uri: string, location: string, fileExtension: string) {
    const path = this.getPath(uri, location, fileExtension);
    const readStream = createReadStream(path);

    return readStream;
  }

  getPath(uri: string, location: string, fileExtension: string) {
    const path = this.resolveLocation(location);
    return `${path}/${uri}.${fileExtension}`;
  }

  static DownloadsLocation() {
    return 'downloads';
  }

  static ConvertedLocation() {
    return 'converted';
  }

  private resolveLocation(location: string) {
    if (location === DiskDriver.DownloadsLocation()) {
      return this.downloadedTracksPath;
    }
    if (location === DiskDriver.ConvertedLocation()) {
      return this.convertedTracksPath;
    }
    return new Error('No such location configured.');
  }
}
