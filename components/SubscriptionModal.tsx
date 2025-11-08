import React from 'react';
import { SubscriptionTier } from '@/types';
import { TIER_LIMITS } from '@/constants';
import { CheckIcon, StarIcon } from '@/components/Icons';

interface SubscriptionModalProps {
    onClose: () => void;
    userTier: SubscriptionTier;
}

const tierDetails = {
    [SubscriptionTier.BASIC]: {
        name: 'Basic',
        price: 'Miễn phí',
        description: 'Tuyệt vời để bắt đầu và thử nghiệm các tính năng cốt lõi.',
        limit: TIER_LIMITS[SubscriptionTier.BASIC],
        features: [
            'Tổng hợp văn bản thành giọng nói',
            'Truy cập các giọng nói tiêu chuẩn',
            'Tải xuống file âm thanh WAV'
        ],
        style: {
            bg: 'bg-gray-800',
            border: 'border-gray-700',
            button: 'bg-gray-600 cursor-default'
        }
    },
    [SubscriptionTier.PRO]: {
        name: 'Pro',
        price: 'Liên hệ',
        description: 'Dành cho người dùng thường xuyên cần giới hạn cao hơn.',
        limit: TIER_LIMITS[SubscriptionTier.PRO],
        features: [
            'Tất cả tính năng của gói Basic',
            'Giới hạn ký tự cao hơn đáng kể',
            'Hỗ trợ ưu tiên'
        ],
        style: {
            bg: 'bg-blue-900/50',
            border: 'border-blue-500',
            button: 'bg-blue-600 hover:bg-blue-700'
        }
    },
    [SubscriptionTier.ULTRA]: {
        name: 'Ultra',
        price: 'Liên hệ',
        description: 'Giải pháp toàn diện cho doanh nghiệp và người dùng chuyên nghiệp.',
        limit: TIER_LIMITS[SubscriptionTier.ULTRA],
        features: [
            'Tất cả tính năng của gói Pro',
            'Không giới hạn ký tự',
            'Truy cập sớm các tính năng mới',
            'Hỗ trợ chuyên sâu'
        ],
        style: {
            bg: 'bg-purple-900/50',
            border: 'border-purple-500',
            button: 'bg-purple-600 hover:bg-purple-700'
        }
    }
};

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ onClose, userTier }) => {

    const PlanCard: React.FC<{ tier: SubscriptionTier }> = ({ tier }) => {
        const details = tierDetails[tier];
        const isCurrentUserTier = userTier === tier;

        return (
            <div className={`flex flex-col rounded-lg p-6 border-2 ${details.style.border} ${details.style.bg} relative`}>
                 {tier !== SubscriptionTier.BASIC && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-purple-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 text-white shadow-lg">
                        <StarIcon className="w-4 h-4" />
                        Nâng cấp
                    </div>
                )}
                <h3 className="text-2xl font-bold text-white text-center">{details.name}</h3>
                <p className="text-center text-gray-400 mt-1 h-12">{details.description}</p>

                <div className="my-6 text-center">
                    <span className="text-4xl font-extrabold text-white">{details.limit === Infinity ? 'Vô hạn' : details.limit.toLocaleString()}</span>
                    <span className="text-lg font-medium text-gray-400"> ký tự</span>
                </div>

                <ul className="space-y-3 text-gray-300 flex-grow">
                    {details.features.map((feature, index) => (
                        <li key={index} className="flex items-start">
                            <CheckIcon className="w-5 h-5 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                            <span>{feature}</span>
                        </li>
                    ))}
                </ul>

                {isCurrentUserTier ? (
                    <button
                        disabled
                        className={`w-full mt-8 py-3 px-4 rounded-lg font-semibold text-white transition-colors ${details.style.button}`}
                    >
                        Gói Hiện Tại
                    </button>
                ) : tier === SubscriptionTier.BASIC ? (
                    <div className="mt-8 h-12" aria-hidden="true" />
                ) : (
                    <a
                        href="https://zalo.me/0985351304"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block text-center w-full mt-8 py-3 px-4 rounded-lg font-semibold text-white transition-colors ${details.style.button}`}
                    >
                        Liên hệ Nâng cấp
                    </a>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl relative animate-fade-in" onClick={e => e.stopPropagation()}>
                <style>{`
                    @keyframes fade-in {
                        from { opacity: 0; transform: scale(0.95); }
                        to { opacity: 1; transform: scale(1); }
                    }
                    .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
                `}</style>
                <div className="p-6 text-center border-b border-gray-700">
                    <h2 className="text-3xl font-bold text-white">Các Gói Dịch Vụ</h2>
                    <p className="text-gray-400 mt-2">Chọn gói phù hợp nhất với nhu cầu sử dụng của bạn.</p>
                </div>

                <div className="p-8 grid grid-cols-1 md:grid-cols-3 gap-8">
                    <PlanCard tier={SubscriptionTier.BASIC} />
                    <PlanCard tier={SubscriptionTier.PRO} />
                    <PlanCard tier={SubscriptionTier.ULTRA} />
                </div>
                 <div className="p-4 bg-gray-900/50 text-right rounded-b-xl">
                    <button onClick={onClose} className="px-5 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 text-sm font-medium">Đóng</button>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionModal;