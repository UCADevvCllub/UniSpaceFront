import {
    LOGIN_SUCCESS,
    LOGIN_FAIL,
    USER_LOADED_SUCCESS,
    USER_LOADED_FAIL,
    AUTHENTICATED_SUCCESS,
    AUTHENTICATED_FAIL,
    RESET_PASSWORD_SUCCESS,
    RESET_PASSWORD_FAIL,
    RESET_PASSWORD_CONFIRM_SUCCESS,
    RESET_PASSWORD_CONFIRM_FAIL,
    LOGOUT
} from '../actions/types';

const initialState = {
    access: typeof window !== 'undefined' ? localStorage.getItem('access') : null,
    refresh: typeof window !== 'undefined' ? localStorage.getItem('refresh') : null,
    isAuthenticated: null,
    user: null,
    loginError: null
};

export default function (state = initialState, action) {
    const { type, payload } = action;

    switch (type) {
        case AUTHENTICATED_SUCCESS:
            return {
                ...state,
                isAuthenticated: true
            }

        case LOGIN_SUCCESS:
            if (typeof window !== 'undefined') {
                localStorage.setItem('access', payload.access);
                localStorage.setItem('refresh', payload.refresh);
            }
            return {
                ...state,
                isAuthenticated: true,
                access: payload.access,
                refresh: payload.refresh,
                loginError: null,
            }

        case USER_LOADED_SUCCESS:
            return {
                ...state,
                user: payload
            }

        case AUTHENTICATED_FAIL:
            return {
                ...state,
                isAuthenticated: false
            }

        case USER_LOADED_FAIL:
            return {
                ...state,
                user: null
            }

        case LOGIN_FAIL:
        case LOGOUT:
            if (typeof window !== 'undefined') {
                localStorage.removeItem('access');
                localStorage.removeItem('refresh');
            }
            return {
                ...state,
                isAuthenticated: false,
                access: null,
                refresh: null,
                user: null,
                loginError: type === LOGIN_FAIL ? 'Your email or password is incorrect' : null
            }
        case RESET_PASSWORD_CONFIRM_SUCCESS:
        case RESET_PASSWORD_CONFIRM_FAIL:
        case RESET_PASSWORD_FAIL:
        case RESET_PASSWORD_SUCCESS:
            return {
                ...state
            }

        default:
            return state;
    }
}
