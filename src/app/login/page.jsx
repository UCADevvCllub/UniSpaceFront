"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
// @ts-ignore
import { login } from '@/actions/auth';

export default function LoginPage() {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const { email, password } = formData;
    const dispatch = useDispatch();
    const router = useRouter();

    const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

    const loginError = useSelector((state) => state.auth.loginError);

    useEffect(() => {
        if (isAuthenticated) {
            router.push('/');
        }
    }, [isAuthenticated, router]);

    const onChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

    const onSubmit = e => {
        e.preventDefault();
        // @ts-ignore
        dispatch(login(email, password));
    };

    return (
        <div className='mx-auto max-w-md mt-10 p-6 bg-white rounded-lg border border-slate-200 shadow-sm'>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Sign In</h1>
            <p className="text-slate-500 mb-6 text-sm">Sign into your Campus Hub Account</p>
            <form onSubmit={onSubmit} className="space-y-4">
                {loginError && (
                    <div className="p-3 bg-red-50 border border-red-300 text-red-700 rounded text-sm">
                        {loginError}
                    </div>
                )}
                <div>
                    <input
                        className='w-full p-2 border border-slate-300 rounded text-slate-800 focus:outline-blue-500'
                        type='email'
                        placeholder='Email'
                        name='email'
                        value={email}
                        onChange={onChange}
                        required
                    />
                </div>
                <div>
                    <input
                        className='w-full p-2 border border-slate-300 rounded text-slate-800 focus:outline-blue-500'
                        type='password'
                        placeholder='Password'
                        name='password'
                        value={password}
                        onChange={onChange}
                        minLength='8'
                        required
                    />
                </div>
                <button
                    className='w-full py-2 bg-slate-900 text-white rounded font-semibold hover:bg-slate-800 transition'
                    type='submit'
                >
                    Login
                </button>
            </form>
            <p className='mt-4 text-sm text-slate-500'>
                Forgot your password? <Link href='/reset-password' className="text-blue-600 hover:underline">Reset Password</Link>
            </p>
        </div>
    );
}
