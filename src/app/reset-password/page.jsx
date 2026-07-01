"use client";

import React, { useState, useEffect } from 'react'; // 1. Import useEffect
import { useRouter } from 'next/navigation';
import { useDispatch } from 'react-redux';
// @ts-ignore
import { reset_password } from '@/actions/auth';

export default function ResetPasswordPage() {
    const [requestSent, setRequestSent] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
    });

    const { email } = formData;
    const dispatch = useDispatch();
    const router = useRouter();

    // 2. Perform the redirect inside useEffect
    useEffect(() => {
        if (requestSent) {
            router.push('/');
        }
    }, [requestSent, router]);

    const onChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

    const onSubmit = e => {
        e.preventDefault();
        // @ts-ignore
        dispatch(reset_password(email));
        setRequestSent(true);
    };

    // 3. Just return null if request is sent (no direct router.push here)
    if (requestSent) {
        return null;
    }

    return (
        <div className='mx-auto max-w-md mt-10 p-6 bg-white rounded-lg border border-slate-200 shadow-sm'>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Request Password Reset</h1>
            <p className="text-slate-500 mb-6 text-sm">Enter your account email to receive a reset link</p>
            <form onSubmit={onSubmit} className="space-y-4">
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
                <button
                    className='w-full py-2 bg-slate-900 text-white rounded font-semibold hover:bg-slate-800 transition'
                    type='submit'
                >
                    Reset Password
                </button>
            </form>
        </div>
    );
}
