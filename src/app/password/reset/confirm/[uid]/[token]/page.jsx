"use client";

import React, { useState, useEffect } from 'react'; // 1. Import useEffect
import { useRouter, useParams } from 'next/navigation';
import { useDispatch } from 'react-redux';
// @ts-ignore
import { reset_password_confirm } from '@/actions/auth';

export default function ResetPasswordConfirmPage() {
    const [requestSent, setRequestSent] = useState(false);
    const [formData, setFormData] = useState({
        new_password: '',
        re_new_password: '',
    });

    const { new_password, re_new_password } = formData;
    const dispatch = useDispatch();
    const router = useRouter();
    const { uid, token } = useParams();

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
        dispatch(reset_password_confirm(uid, token, new_password, re_new_password));
        setRequestSent(true);
    };

    // 3. Just return null if request is sent
    if (requestSent) {
        return null;
    }

    return (
        <div className='mx-auto max-w-md mt-10 p-6 bg-white rounded-lg border border-slate-200 shadow-sm'>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Set New Password</h1>
            <p className="text-slate-500 mb-6 text-sm">Please set your new account password</p>
            <form onSubmit={onSubmit} className="space-y-4">
                <div>
                    <input
                        className='w-full p-2 border border-slate-300 rounded text-slate-800 focus:outline-blue-500'
                        type='password'
                        placeholder='New Password'
                        name='new_password'
                        value={new_password}
                        onChange={onChange}
                        minLength='8'
                        required
                    />
                </div>
                <div>
                    <input
                        className='w-full p-2 border border-slate-300 rounded text-slate-800 focus:outline-blue-500'
                        type='password'
                        placeholder='Confirm New Password'
                        name='re_new_password'
                        value={re_new_password}
                        onChange={onChange}
                        minLength='8'
                        required
                    />
                </div>
                <button
                    className='w-full py-2 bg-slate-900 text-white rounded font-semibold hover:bg-slate-800 transition'
                    type='submit'
                >
                    Confirm New Password
                </button>
            </form>
        </div>
    );
}
