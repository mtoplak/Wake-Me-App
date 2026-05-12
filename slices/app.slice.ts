import { useDispatch, useSelector } from 'react-redux';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { State, Dispatch } from '@/utils/store';
import { User } from '@/types';
import { DEFAULT_LANGUAGE, type Language } from '@/i18n';

export interface AppState {
  checked: boolean;
  loggedIn: boolean;
  user?: User;
  language: Language;
}

const initialState: AppState = {
  checked: false,
  loggedIn: false,
  user: undefined,
  language: DEFAULT_LANGUAGE,
};

const slice = createSlice({
  name: 'app',
  initialState,
  reducers: {
    setLoggedIn: (state: AppState, { payload }: PayloadAction<boolean>) => {
      state.checked = true;
      state.loggedIn = payload;
    },
    setUser: (state: AppState, { payload }: PayloadAction<User | undefined>) => {
      state.user = payload;
    },
    setLanguage: (state: AppState, { payload }: PayloadAction<Language>) => {
      state.language = payload;
    },
    reset: () => initialState,
  },
});

export function useAppSlice() {
  const dispatch = useDispatch<Dispatch>();
  const state = useSelector(({ app }: State) => app);
  return { dispatch, ...state, ...slice.actions };
}

export default slice.reducer;
