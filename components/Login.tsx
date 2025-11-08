import React, { useState } from 'react';
import { User, Notification } from '@/types';
import { loginUser, registerUser } from '@/services/apiService';

interface LoginProps {
    onLoginSuccess: (user: User) => void;
    onSetNotification: (notification: Omit<Notification, 'id'>) => void;
}

const Login: React.FC<LoginProps> = ({ onLoginSuccess, onSetNotification }) => {
    const [isLoginView, setIsLoginView] = useState(true);
    const [isLoading, setIsLoading] = useState(false);

    // Login State
    const [loginUsername, setLoginUsername] = useState('');
    const [loginPassword, setLoginPassword] = useState('');

    // Register State
    const [regFirstName, setRegFirstName] = useState('');
    const [regLastName, setRegLastName] = useState('');
    const [regUsername, setRegUsername] = useState('');
    const [regPassword, setRegPassword] = useState('');
    const [regConfirmPassword, setRegConfirmPassword] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const user = await loginUser(loginUsername, loginPassword);
            onLoginSuccess(user);
            onSetNotification({ type: 'success', message: 'Đăng nhập thành công!' });
        } catch (error) {
            onSetNotification({ type: 'error', message: error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (regPassword !== regConfirmPassword) {
            onSetNotification({ type: 'error', message: 'Mật khẩu không khớp.' });
            return;
        }
        setIsLoading(true);
        try {
            const newUser = await registerUser({
                firstName: regFirstName,
                lastName: regLastName,
                username: regUsername,
                password: regPassword,
            });
            onLoginSuccess(newUser);
            onSetNotification({ type: 'success', message: 'Đăng ký thành công! Chào mừng bạn.' });
        } catch (error) {
            onSetNotification({ type: 'error', message: error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định' });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
            <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md">
                <h1 className="text-3xl font-bold text-center mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
                    {isLoginView ? 'TTS by LÝ VĂN HIỆP ( KIOSOO )' : 'Tạo tài khoản'}
                </h1>

                {isLoginView ? (
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label htmlFor="username-login" className="block text-sm font-medium text-gray-300">Tên đăng nhập</label>
                            <input
                                id="username-login"
                                type="text"
                                value={loginUsername}
                                onChange={(e) => setLoginUsername(e.target.value)}
                                required
                                className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label htmlFor="password-login" className="block text-sm font-medium text-gray-300">Mật khẩu</label>
                            <input
                                id="password-login"
                                type="password"
                                value={loginPassword}
                                onChange={(e) => setLoginPassword(e.target.value)}
                                required
                                className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm py-2 px-3 text-white focus:outline-none focus:ring-purple-500 focus:border-purple-500"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-500"
                        >
                            {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="flex gap-4">
                            <div className="flex-1">
                                <label htmlFor="firstName" className="block text-sm font-medium text-gray-300">Tên</label>
                                <input id="firstName" type="text" value={regFirstName} onChange={(e) => setRegFirstName(e.target.value)} required className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-white focus:ring-purple-500 focus:border-purple-500"/>
                            </div>
                            <div className="flex-1">
                                <label htmlFor="lastName" className="block text-sm font-medium text-gray-300">Họ</label>
                                <input id="lastName" type="text" value={regLastName} onChange={(e) => setRegLastName(e.target.value)} required className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-white focus:ring-purple-500 focus:border-purple-500"/>
                            </div>
                        </div>
                        <div>
                            <label htmlFor="username-reg" className="block text-sm font-medium text-gray-300">Tên đăng nhập</label>
                            <input id="username-reg" type="text" value={regUsername} onChange={(e) => setRegUsername(e.target.value)} required className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-white focus:ring-purple-500 focus:border-purple-500"/>
                        </div>
                        <div>
                            <label htmlFor="password-reg" className="block text-sm font-medium text-gray-300">Mật khẩu</label>
                            <input id="password-reg" type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} required className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-white focus:ring-purple-500 focus:border-purple-500"/>
                        </div>
                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300">Xác nhận mật khẩu</label>
                            <input id="confirmPassword" type="password" value={regConfirmPassword} onChange={(e) => setRegConfirmPassword(e.target.value)} required className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md py-2 px-3 text-white focus:ring-purple-500 focus:border-purple-500"/>
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-500"
                        >
                            {isLoading ? 'Đang đăng ký...' : 'Đăng ký'}
                        </button>
                    </form>
                )}
                <div className="mt-6 text-center">
                    <button onClick={() => setIsLoginView(!isLoginView)} className="text-sm text-cyan-400 hover:underline">
                        {isLoginView ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;