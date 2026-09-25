import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NoiseType = "music" | "construction" | "shouting" | "other" | "";

export type YourDetails = {
  firstName: string;
  lastName: string;
  email: string;
};

const emptyDetails: YourDetails = {
  firstName: "",
  lastName: "",
  email: "",
};

type NoiseStore = {
  noiseType: NoiseType;
  howLong: string;
  description: string;
  yourDetails: YourDetails;
  caseReference: string;

  setNoiseType: (noiseType: NoiseType) => void;
  setHowLong: (howLong: string) => void;
  setDescription: (description: string) => void;
  setYourDetails: (yourDetails: YourDetails) => void;
  setCaseReference: (caseReference: string) => void;
  reset: () => void;
};

export const useNoiseStore = create<NoiseStore>()(
  persist(
    (set) => ({
      noiseType: '',
      howLong: '',
      description: '',
      yourDetails: emptyDetails,
      caseReference: '',

      setNoiseType: (noiseType) => set({ noiseType }),
      setHowLong: (howLong) => set({ howLong }),
      setDescription: (description) => set({ description }),
      setYourDetails: (yourDetails) => set({ yourDetails }),
      setCaseReference: (caseReference) => set({ caseReference }),
      reset: () =>
        set({
          noiseType: '',
          howLong: '',
          description: '',
          yourDetails: emptyDetails,
          caseReference: '',
        }),
    }),
    { name: 'mini-noise-reporter-storage' },
  ),
);
