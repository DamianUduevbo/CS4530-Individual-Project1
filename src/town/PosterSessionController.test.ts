import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { nanoid } from 'nanoid';
import { readFileSync } from 'fs';
import { Interactable, TownEmitter, PosterSessionArea } from '../types/CoveyTownSocket';
import TownsStore from '../lib/TownsStore';
import { getLastEmittedEvent, mockPlayer, MockedPlayer, isPosterSessionArea } from '../TestUtils';
import { TownsController } from './TownsController';

type TestTownData = {
  friendlyName: string;
  townID: string;
  isPubliclyListed: boolean;
  townUpdatePassword: string;
};

const broadcastEmitter = jest.fn();
describe('TownsController integration tests', () => {
  let controller: TownsController;

  const createdTownEmitters: Map<string, DeepMockProxy<TownEmitter>> = new Map();
  async function createTownForTesting(
    friendlyNameToUse?: string,
    isPublic = false,
  ): Promise<TestTownData> {
    const friendlyName =
      friendlyNameToUse !== undefined
        ? friendlyNameToUse
        : `${isPublic ? 'Public' : 'Private'}TestingTown=${nanoid()}`;
    const ret = await controller.createTown({
      friendlyName,
      isPubliclyListed: isPublic,
      mapFile: 'testData/indoors.json',
    });
    return {
      friendlyName,
      isPubliclyListed: isPublic,
      townID: ret.townID,
      townUpdatePassword: ret.townUpdatePassword,
    };
  }
  function getBroadcastEmitterForTownID(townID: string) {
    const ret = createdTownEmitters.get(townID);
    if (!ret) {
      throw new Error(`Could not find broadcast emitter for ${townID}`);
    }
    return ret;
  }

  beforeAll(() => {
    // Set the twilio tokens to dummy values so that the unit tests can run
    process.env.TWILIO_API_AUTH_TOKEN = 'testing';
    process.env.TWILIO_ACCOUNT_SID = 'ACtesting';
    process.env.TWILIO_API_KEY_SID = 'testing';
    process.env.TWILIO_API_KEY_SECRET = 'testing';
  });

  beforeEach(async () => {
    createdTownEmitters.clear();
    broadcastEmitter.mockImplementation((townID: string) => {
      const mockRoomEmitter = mockDeep<TownEmitter>();
      createdTownEmitters.set(townID, mockRoomEmitter);
      return mockRoomEmitter;
    });
    TownsStore.initializeTownsStore(broadcastEmitter);
    controller = new TownsController();
  });

  describe('Interactables', () => {
    let testingTown: TestTownData;
    let player: MockedPlayer;
    let sessionToken: string;
    let interactables: Interactable[];
    beforeEach(async () => {
      testingTown = await createTownForTesting(undefined, true);
      player = mockPlayer(testingTown.townID);
      await controller.joinTown(player.socket);
      const initialData = getLastEmittedEvent(player.socket, 'initialize');
      sessionToken = initialData.sessionToken;
      interactables = initialData.interactables;
    });

    describe('Create Poster Session Area', () => {
      it('Executes without error when creating a new poster session area', async () => {
        const posterSessionArea = interactables.find(eachPoster =>
          isPosterSessionArea(eachPoster),
        ) as PosterSessionArea;

        if (!posterSessionArea) {
          fail('Expected at least one poster session area to be returned in the initial join data');
        } else {
          const newPosterSessionArea = {
            id: posterSessionArea.id,
            stars: 0,
            title: 'Test title',
            imageContents: readFileSync('testData/poster.jpg', 'utf-8'),
          };
          await controller.createPosterSessionArea(
            testingTown.townID,
            sessionToken,
            newPosterSessionArea,
          );
          // Check to see that the poster session area was successfully updated
          const townEmitter = getBroadcastEmitterForTownID(testingTown.townID);
          const updateMessage = getLastEmittedEvent(townEmitter, 'interactableUpdate');
          if (isPosterSessionArea(updateMessage)) {
            expect(updateMessage).toEqual(newPosterSessionArea);
          } else {
            fail(
              'Expected an interactableUpdate to be dispatched with the new poster session area',
            );
          }
        }
      });
      it('Returns an error message if the town ID is invalid', async () => {
        const posterSessionArea = interactables.find(eachPoster =>
          isPosterSessionArea(eachPoster),
        ) as PosterSessionArea;

        const newPosterSessionArea = {
          id: posterSessionArea.id,
          stars: 0,
          title: 'Test title',
          imageContents: readFileSync('testData/poster.jpg', 'utf-8'),
        };
        await expect(
          controller.createPosterSessionArea(nanoid(), sessionToken, newPosterSessionArea),
        ).rejects.toThrow();
      });
      it('Checks for a valid session token before creating a poster session area', async () => {
        const invalidSessionToken = nanoid();
        const posterSessionArea = interactables.find(eachPoster =>
          isPosterSessionArea(eachPoster),
        ) as PosterSessionArea;

        const newPosterSessionArea = {
          id: posterSessionArea.id,
          stars: 0,
          title: 'Test title',
          imageContents: readFileSync('testData/poster.jpg', 'utf-8'),
        };
        await expect(
          controller.createPosterSessionArea(
            testingTown.townID,
            invalidSessionToken,
            newPosterSessionArea,
          ),
        ).rejects.toThrow();
      });
      it('Returns an error message if addPosterSessionArea returns false', async () => {
        const posterSessionArea = interactables.find(eachPoster =>
          isPosterSessionArea(eachPoster),
        ) as PosterSessionArea;

        const newPosterSessionArea = {
          id: nanoid(),
          stars: posterSessionArea.stars,
          title: posterSessionArea.title,
          imageContents: posterSessionArea.imageContents,
        };
        await expect(
          controller.createPosterSessionArea(
            testingTown.townID,
            sessionToken,
            newPosterSessionArea,
          ),
        ).rejects.toThrow();
      });
      it('Cant create a poster session area with no image', async () => {
        const posterSessionArea = interactables.find(eachPoster =>
          isPosterSessionArea(eachPoster),
        ) as PosterSessionArea;

        if (!posterSessionArea) {
          fail('Expected at least one poster session area to be returned in the initial join data');
        } else {
          const newPosterSessionArea = {
            id: posterSessionArea.id,
            stars: 0,
            title: 'Test title',
            // image contents is undefined
          };
          await expect(
            controller.createPosterSessionArea(
              testingTown.townID,
              sessionToken,
              newPosterSessionArea,
            ),
          ).rejects.toThrow();
        }
      });
      it('Cant create a poster session area with no title', async () => {
        const posterSessionArea = interactables.find(eachPoster =>
          isPosterSessionArea(eachPoster),
        ) as PosterSessionArea;

        if (!posterSessionArea) {
          fail('Expected at least one poster session area to be returned in the initial join data');
        } else {
          const newPosterSessionArea = {
            id: posterSessionArea.id,
            stars: 0,
            imageContents: readFileSync('testData/poster.jpg', 'utf-8'),
            // title is undefined
          };
          await expect(
            controller.createPosterSessionArea(
              testingTown.townID,
              sessionToken,
              newPosterSessionArea,
            ),
          ).rejects.toThrow();
        }
      });
    });
    describe('Interact with existing Poster Session Area', () => {
      // testing in progress
      it('Increments number of stars on a poster session area', async () => {
        const posterSessionArea = interactables.find(eachPoster =>
          isPosterSessionArea(eachPoster),
        ) as PosterSessionArea;

        if (!posterSessionArea) {
          fail('Expected at least one poster session area to be returned in the initial join data');
        } else {
          const newPosterSessionArea = {
            id: posterSessionArea.id,
            stars: 0,
            title: 'Test title',
            imageContents: readFileSync('testData/poster.jpg', 'utf-8'),
          };
          await controller.createPosterSessionArea(
            testingTown.townID,
            sessionToken,
            newPosterSessionArea,
          );
          const numStars = await controller.incrementPosterAreaStars(
            testingTown.townID,
            posterSessionArea.id,
            sessionToken,
          );
          expect(numStars).toEqual(newPosterSessionArea.stars + 1);
        }
      });

      it('Gets the image contents of a poster session area', async () => {
        const posterSessionArea = interactables.find(eachPoster =>
          isPosterSessionArea(eachPoster),
        ) as PosterSessionArea;

        if (!posterSessionArea) {
          fail('Expected at least one poster session area to be returned in the initial join data');
        } else {
          const newPosterSessionArea = {
            id: posterSessionArea.id,
            stars: 0,
            title: 'Test title',
            imageContents: readFileSync('testData/poster.jpg', 'utf-8'),
          };
          await controller.createPosterSessionArea(
            testingTown.townID,
            sessionToken,
            newPosterSessionArea,
          );
          const imageContents = await controller.getPosterAreaImageContents(
            testingTown.townID,
            posterSessionArea.id,
            sessionToken,
          );
          expect(imageContents).toEqual(newPosterSessionArea.imageContents);
        }
      });

      it('Gets the image contents of a poster session area', async () => {
        const posterSessionArea = interactables.find(eachPoster =>
          isPosterSessionArea(eachPoster),
        ) as PosterSessionArea;

        if (!posterSessionArea) {
          fail('Expected at least one poster session area to be returned in the initial join data');
        } else {
          const newPosterSessionArea = {
            id: posterSessionArea.id,
            stars: 0,
            title: 'Test title',
            imageContents: readFileSync('testData/poster.jpg', 'utf-8'),
          };
          await controller.createPosterSessionArea(
            testingTown.townID,
            sessionToken,
            newPosterSessionArea,
          );
          const imageContents = await controller.getPosterAreaImageContents(
            testingTown.townID,
            posterSessionArea.id,
            sessionToken,
          );
          expect(imageContents).toEqual(newPosterSessionArea.imageContents);
        }
      });

      it('Throw an error message if we increment stars via an invalid town id', async () => {
        const posterSessionArea = interactables.find(eachPoster =>
          isPosterSessionArea(eachPoster),
        ) as PosterSessionArea;

        await expect(
          controller.incrementPosterAreaStars(nanoid(), posterSessionArea.id, sessionToken),
        ).rejects.toThrow();
      });
      it('Returns an error message if the town ID is invalid when calling createPosterSessionArea', async () => {
        const posterSessionArea = interactables.find(eachPoster =>
          isPosterSessionArea(eachPoster),
        ) as PosterSessionArea;

        const newPosterSessionAreaModel = {
          id: posterSessionArea.id,
          stars: 0,
          title: 'Test title',
          imageContents: readFileSync('testData/poster.jpg', 'utf-8'),
        };

        await expect(
          controller.createPosterSessionArea(nanoid(), sessionToken, newPosterSessionAreaModel),
        ).rejects.toThrow();
      });

      it('Throws an error message if createPosterSessionArea is given an invalid poster ID', async () => {
        const newPosterSessionAreaModel = {
          id: nanoid(),
          stars: 0,
          title: 'Test title',
          imageContents: readFileSync('testData/poster.jpg', 'utf-8'),
        };

        await expect(
          controller.createPosterSessionArea(
            testingTown.townID,
            sessionToken,
            newPosterSessionAreaModel,
          ),
        ).rejects.toThrow();
      });

      it('Throws an error message when attemping to increment stars on a non-PosterSessionArea object', async () => {
        const posterSessionArea = undefined as unknown;

        await expect(
          controller.createPosterSessionArea(
            testingTown.townID,
            sessionToken,
            posterSessionArea as PosterSessionArea,
          ),
        ).rejects.toThrow();
      });

      it('Throws an error message if createPosterSessionArea is given an invalid session token', async () => {
        const posterSessionArea = interactables.find(eachPoster =>
          isPosterSessionArea(eachPoster),
        ) as PosterSessionArea;

        const newPosterSessionAreaModel = {
          id: posterSessionArea.id,
          stars: 0,
          title: 'Test title',
          imageContents: readFileSync('testData/poster.jpg', 'utf-8'),
        };

        await expect(
          controller.createPosterSessionArea(
            testingTown.townID,
            nanoid(),
            newPosterSessionAreaModel,
          ),
        ).rejects.toThrow();
      });
    });
  });
});
