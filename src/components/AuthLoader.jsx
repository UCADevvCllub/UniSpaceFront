"use client";

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { checkAuthenticated, load_user } from '@/actions/auth';

export default function AuthLoader({ children }) {
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(checkAuthenticated());
        dispatch(load_user());
    }, [dispatch]);

    return <>{children}</>;
}
