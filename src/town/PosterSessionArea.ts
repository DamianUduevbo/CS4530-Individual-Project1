import { ITiledMapObject } from '@jonbell/tiled-map-type-guard';
import Player from '../lib/Player';
import {
  BoundingBox,
  TownEmitter,
  PosterSessionArea as PosterSessionAreaModel,
} from '../types/CoveyTownSocket';
import InteractableArea from './InteractableArea';

export default class PosterSessionArea extends InteractableArea {
  private _stars: number;

  private _title: string | undefined;

  private _imageContents: string | undefined;

  public get stars() {
    return this._stars;
  }

  public get title() {
    return this._title;
  }

  public get imageContents() {
    return this._imageContents;
  }

  /**
   * Creates a new PosterSessionArea
   *
   * @param viewingArea model containing this area's starting state
   * @param coordinates the bounding box that defines this viewing area
   * @param townEmitter a broadcast emitter that can be used to emit updates to players
   */
  public constructor(
    { id, stars, imageContents, title }: PosterSessionAreaModel,
    coordinates: BoundingBox,
    townEmitter: TownEmitter,
  ) {
    super(id, coordinates, townEmitter);

    try {
      this._stars = Math.abs(stars);
    } catch (e) {
      throw new Error('Star rating not given');
    }

    try {
      this._imageContents = imageContents;
    } catch (error) {
      throw new Error('Image content not given or invalid');
    }

    try {
      this._title = title;
    } catch (error) {
      throw new Error('Title was not given or is invalid');
    }
  }

  /**
   * Removes a player from this poster session area.
   *
   * When the last player leaves, this method clears the poster and title, and resets the number of stars, and emits this update to all players in the Town.
   *
   * @param player
   */
  public remove(player: Player): void {
    super.remove(player);
    if (this._occupants.length <= 0) {
      this._stars = 0;
      this._title = undefined;
      this._imageContents = undefined;
      this._emitAreaChanged();
    }
  }

  /**
   * Updates the state of this PosterSessionArea, setting the poster, title, and stars properties
   *
   * @param posterSessionArea updated model
   */
  public updateModel(updatedModel: PosterSessionAreaModel) {
    this._stars = Math.abs(updatedModel.stars);
    this._title = updatedModel.title;
    this._imageContents = updatedModel.imageContents;
  }

  /**
   * Convert this PosterSessionArea instance to a simple PosterSessionAreaModel suitable for
   * transporting over a socket to a client (i.e., serializable).
   */
  public toModel(): PosterSessionAreaModel {
    return {
      id: this.id,
      stars: this.stars,
      imageContents: this.imageContents,
      title: this.title,
    };
  }

  /**
   * Creates a new PosterSessionArea object that will represent a PosterSessionArea object in the town map.
   * @param mapObject An ITiledMapObject that represents a rectangle in which this viewing area exists
   * @param townEmitter An emitter that can be used by this viewing area to broadcast updates to players in the town
   * @returns
   */
  public static fromMapObject(
    mapObject: ITiledMapObject,
    townEmitter: TownEmitter,
  ): PosterSessionArea {
    const { name, width, height } = mapObject;

    if (!width || !height) {
      throw new Error('Missing width and/or height in mapObject.');
    }

    const newPosterSessionAreaModel = {
      id: name,
      stars: 0,
      imageContents: undefined,
      title: undefined,
    };

    const coordinate: BoundingBox = {
      x: mapObject.x,
      y: mapObject.y,
      width,
      height,
    };

    return new PosterSessionArea(newPosterSessionAreaModel, coordinate, townEmitter);
  }
}
