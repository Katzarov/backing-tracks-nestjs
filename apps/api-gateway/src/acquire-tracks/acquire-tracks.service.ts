import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { EntityManager } from 'typeorm';
import * as fs from 'node:fs/promises';
import { randomUUID } from 'crypto';
import { lastValueFrom, Observable } from 'rxjs';
import { SpotifyService } from './spotify.service';
import { DownloadYouTubeVideoDto } from './dto/download-youtube-video.dto';
import { TracksService } from '../tracks/tracks.service';
import { Track, TrackInstrument, TrackType } from '../tracks/track.entity';
import { ConfigService } from '@nestjs/config';
import { UploadTrackDto } from './dto/upload-track.dto';
import { TrackMeta } from '../meta/trackMeta.entity';
import { Artist } from '../meta/artist.entity';
import { UserService } from '../user/user.service';

@Injectable()
export class AcquireTracksService {
  private tracksFolder;
  constructor(
    @Inject('YOUTUBE_DOWNLOADER_SERVICE') private youtubeService: ClientProxy,
    @Inject('FILE_CONVERTER_SERVICE') private fileConverterService: ClientProxy,
    private entityManager: EntityManager,
    private tracksService: TracksService,
    private usersService: UserService,
    private spotifyService: SpotifyService,
    configService: ConfigService,
  ) {
    this.tracksFolder = configService.getOrThrow<string>(
      'storage.localDisk.convertedFolder',
    );
  }

  private download(url: string, name: string): Observable<string> {
    const pattern = { cmd: 'downloadYouTubeVideo' };
    const payload = { url, name };
    return this.youtubeService.send(pattern, payload);
  }

  private convert(name: string): Observable<string> {
    const pattern = { cmd: 'convertFile' };
    const payload = { name };
    return this.fileConverterService.send(pattern, payload);
  }

  private async createAndSaveTrackEntry(
    userId: number,
    resourceId: string,
    spotifyId: string,
    trackType: TrackType,
    trackInstrument: TrackInstrument,
  ) {
    const trackInfo = await this.spotifyService.getTrack(spotifyId);
    const trackName = trackInfo.name;
    const trackDuration = trackInfo.duration_ms; // TODO get duration from the actiual track file itself.

    const artistId = trackInfo.artists[0].id;
    const artistName = trackInfo.artists[0].name;

    const artist = new Artist({ spotifyUri: artistId, artistName });
    const trackMeta = new TrackMeta({ spotifyUri: spotifyId, trackName });
    const track = new Track({
      resourceId,
      duration: trackDuration,
      trackType,
      trackInstrument,
    });

    const user = await this.usersService.findOne(userId);
    track.user = user;

    await this.entityManager.transaction(async (transactionalEntityManager) => {
      const newArtist = await transactionalEntityManager.save(artist);
      trackMeta.artist = newArtist;

      const newTrackMeta = await transactionalEntityManager.save(trackMeta);
      track.meta = newTrackMeta;

      await transactionalEntityManager.save(track);
    });

    // TODO: cleanup files if this fails

    return `new track acquired: ${trackName}, id: ${resourceId}, for user: ${userId}`;
  }

  getYouTubeVideoInfo(url: string) {
    return this.youtubeService.send({ cmd: 'getYouTubeVideoInfo' }, { url });
  }

  async downloadYouTubeVideo(
    userId: number,
    { url, spotifyId, trackType, trackInstrument }: DownloadYouTubeVideoDto,
  ) {
    const resourceId = randomUUID();
    // BIG TODO here: probably want some job/tracker service instead of doing it like this here.
    // some hybrid microservice that also does ss3 with the client to show the download/converter progress, and show all currnet jobs and blah blah..
    // i,e job tracking/execution/notification service(s), will also need a queue, look into rabbitmq
    // put a message broker inbetween all instead of this method call all microservices like that.
    // + notification service that will listen also to all messages and track the result + will notify the client

    // TODO v2, these two microserices will probably end up being lambdas again.. I will need to rethink a bit how the notification/job tracking for the FE client, will be done in this case.

    await lastValueFrom(this.download(url, resourceId));
    await lastValueFrom(this.convert(resourceId));

    const newTrackInfo = await this.createAndSaveTrackEntry(
      userId,
      resourceId,
      spotifyId,
      trackType,
      trackInstrument,
    );
    console.log(newTrackInfo);
    return { msg: newTrackInfo };
  }

  async uploadTrack(
    userId: number,
    { spotifyId, trackType, trackInstrument }: UploadTrackDto,
    file: Express.Multer.File,
  ) {
    const resourceId = randomUUID();
    // TODO: temp, will later switch to streams
    await fs.writeFile(`${this.tracksFolder}/${resourceId}.mp3`, file.buffer);

    const newTrackInfo = await this.createAndSaveTrackEntry(
      userId,
      resourceId,
      spotifyId,
      trackType,
      trackInstrument,
    );
    console.log(newTrackInfo);
    return { msg: newTrackInfo };
  }
}
