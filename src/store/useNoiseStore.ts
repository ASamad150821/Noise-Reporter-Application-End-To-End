import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type NoiseType = "music" | "construction" | "shouting" | "other" | "" ;

export type YourDetails = {
    firstName: string,
    lastName: string,
    email: string
}

let emptyDetails : YourDetails = {
    firstName: "",
    lastName: "",
    email: ""
}

type NoiseStore = {
    noiseType: NoiseType;
    howLong: string;
    description: string;
    yourDetails: YourDetails;
    caseReference: string;

    setNoiseType: (t: NoiseType) => void;
    setHowLong: (h: string) => void;
    setDescription: (d: string) => void;
    setYourDetails: (d: YourDetails) => void;
    setCaseReference: (ref: string) => void;
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

      setNoiseType: (n) => set({ noiseType : n}),
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