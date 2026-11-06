import type { DataManager as Data, StateManager as State } from './Managers.js';

export type DataManager = Pick<Data, keyof Data>;
export type StateManager = Pick<State, keyof State>;
