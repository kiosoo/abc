import React from 'react';
import { SubscriptionTier } from '@/types';
import { TIER_LIMITS } from '@/constants';
import { CheckIcon, StarIcon, InfoIcon } from '@/components/Icons';

interface SubscriptionModalProps {
    onClose: () => void;
    userTier: SubscriptionTier;
}

const tierDetails = {
    [SubscriptionTier.BASIC]: {
        kind: 'standard' as const,
        name: 'Basic',
        price: 'Miễn phí',
        description: 'Tuyệt vời để bắt đầu và thử nghiệm các tính năng cốt lõi.',
        limit: TIER_LIMITS[SubscriptionTier.BASIC],
        features: [
            'Yêu cầu API Key Gemini riêng',
            'Tổng hợp văn bản thành giọng nói',
            'Truy cập các giọng nói tiêu chuẩn',
        ],
        style: {
            bg: 'bg-gray-800',
            border: 'border-gray-700',
            button: 'bg-gray-600 cursor-default'
        }
    },
    [SubscriptionTier.PRO]: {
        kind: 'standard' as const,
        name: 'Pro',
        price: 'Liên hệ',
        description: 'Dành cho người dùng thường xuyên cần giới hạn nhập liệu cao hơn.',
        limit: TIER_LIMITS[SubscriptionTier.PRO],
        features: [
            'Yêu cầu API Key Gemini riêng',
            'Giới hạn ký tự nhập liệu cao hơn',
            'Hỗ trợ ưu tiên'
        ],
        style: {
            bg: 'bg-gray-800',
            border: 'border-gray-700',
            button: 'bg-blue-600 hover:bg-blue-700'
        }
    },
    [SubscriptionTier.ULTRA]: {
        kind: 'standard' as const,
        name: 'Ultra',
        price: 'Liên hệ',
        description: 'Giải pháp toàn diện cho doanh nghiệp và người dùng chuyên nghiệp.',
        limit: TIER_LIMITS[SubscriptionTier.ULTRA],
         features: [
            'Yêu cầu API Key Gemini riêng',
            'Không giới hạn ký tự nhập liệu',
            'Truy cập sớm các tính năng mới',
        ],
        style: {
            bg: 'bg-gray-800',
            border: 'border-gray-700',
            button: 'bg-purple-600 hover:bg-purple-700'
        }
    },
    [SubscriptionTier.STAR]: {
        kind: 'managed' as const,
        name: 'Star',
        price: 'Liên hệ',
        description: 'Trải nghiệm liền mạch với API được quản lý và hạn ngạch hàng ngày lớn.',
        limitText: '140,000 ký tự/ngày',
        subtext: '~3 giờ giọng nói',
        features: [
            'Không cần API Key riêng',
            'Giới hạn ký tự hàng ngày cao',
            'Tất cả tính năng của gói Pro',
            '2 API Key được quản lý (30 lần gọi/ngày)',
        ],
        style: {
            bg: 'bg-blue-900/50',
            border: 'border-blue-500',
            button: 'bg-blue-600 hover:bg-blue-700'
        }
    },
    [SubscriptionTier.SUPER_STAR]: {
        kind: 'managed' as const,
        name: 'Super Star',
        price: 'Liên hệ',
        description: 'Sức mạnh tối đa cho các tác vụ chuyển văn bản thành giọng nói quy mô lớn.',
        limitText: '280,000 ký tự/ngày',
        subtext: '~6 giờ giọng nói',
        features: [
            'Không cần API Key riêng',
            'Giới hạn ký tự hàng ngày cao',
            'Tất cả tính năng của gói Ultra',
            '4 API Key được quản lý (60 lần gọi/ngày)',
        ],
        style: {
            bg: 'bg-purple-900/50',
            border: 'border-purple-500',
            button: 'bg-purple-600 hover:bg-purple-700'
        }
    },
    [SubscriptionTier.VVIP]: {
        kind: 'managed' as const,
        name: 'VVIP',
        price: 'Liên hệ',
        description: 'Giải pháp đỉnh cao cho người dùng chuyên nghiệp và các tác vụ quy mô cực lớn.',
        limitText: '700,000 ký tự/ngày',
        subtext: '~15 giờ giọng nói',
        features: [
            'Không cần API Key riêng',
            'Hạn ngạch ký tự hàng ngày cao nhất',
            'Tất cả tính năng của gói Ultra',
            '10 API Key được quản lý (150 lần gọi/ngày)',
        ],
        style: {
            bg: 'bg-yellow-900/30',
            border: 'border-yellow-500',
            button: 'bg-yellow-600 hover:bg-yellow-700'
        }
    }
};

const SubscriptionModal: React.FC<SubscriptionModalProps> = ({ onClose, userTier }) => {

    const PlanCard: React.FC<{ tier: SubscriptionTier }> = ({ tier }) => {
        const details = tierDetails[tier];
        const isCurrentUserTier = userTier === tier;

        return (
            <div className={`flex flex-col rounded-lg p-6 border-2 ${details.style.border} ${details.style.bg} relative`}>
                 {details.kind === 'managed' && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-purple-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 text-white shadow-lg">
                        <StarIcon className="w-4 h-4" />
                        API Được Quản Lý
                    </div>
                )}
                <h3 className="text-2xl font-bold text-white text-center">{details.name}</h3>
                <p className="text-center text-gray-400 mt-1 h-12">{details.description}</p>

                <div className="my-6 text-center">
                    {details.kind === 'managed' ? (
                        <>
                            <span className="text-4xl font-extrabold text-white">{details.limitText}</span>
                            <span className="block text-lg font-medium text-gray-400">{details.subtext}</span>
                        </>
                    ) : (
                         <>
                            <span className="text-4xl font-extrabold text-white">{details.limit === Infinity ? 'Vô hạn' : details.limit.toLocaleString()}</span>
                            <span className="block text-lg font-medium text-gray-400"> ký tự / lần nhập</span>
                        </>
                    )}
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
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-7xl relative animate-fade-in" onClick={e => e.stopPropagation()}>
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

                <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                        <PlanCard tier={SubscriptionTier.BASIC} />
                        <PlanCard tier={SubscriptionTier.PRO} />
                        <PlanCard tier={SubscriptionTier.ULTRA} />
                        <PlanCard tier={SubscriptionTier.STAR} />
                        <PlanCard tier={SubscriptionTier.SUPER_STAR} />
                        <PlanCard tier={SubscriptionTier.VVIP} />
                    </div>

                    <div className="mt-8 p-4 bg-gray-800/50 border border-gray-700 rounded-lg text-sm">
                        <h4 className="font-bold text-cyan-400 mb-2 flex items-center gap-2">
                            <InfoIcon className="h-5 w-5" />
                            Giải thích về Giới hạn
                        </h4>
                        <p className="text-gray-300 mb-2">
                           <strong>Đối với các gói Basic, Pro, Ultra:</strong> Giới hạn ký tự áp dụng cho độ dài của một lần nhập liệu. Năng suất thực tế phụ thuộc vào số lượng API key Gemini bạn cung cấp.
                        </p>
                         <p className="text-gray-300 mb-2">
                           <strong>Đối với các gói Star, Super Star & VVIP:</strong> Giới hạn ký tự áp dụng cho tổng số lượng bạn có thể xử lý trong một ngày.
                        </p>
                        <p className="text-yellow-300/80 mb-2">
                           <strong>Lưu ý quan trọng:</strong> Ngoài giới hạn ký tự, các gói được quản lý cũng bị giới hạn bởi số lần tạo âm thanh (30 lần/ngày cho Star, 60 cho Super Star, 150 cho VVIP). Hạn ngạch của bạn sẽ hết khi một trong hai giới hạn này được đạt tới trước. Điều này có nghĩa là nếu bạn thực hiện nhiều yêu cầu nhỏ, bạn có thể hết hạn ngạch số lần gọi trước khi hết hạn ngạch ký tự.
                        </p>
                        <ul className="list-disc list-inside text-gray-400 space-y-1">
                            <li>Một API Key Gemini miễn phí cung cấp khoảng <strong>~90,000 lần gọi mỗi ngày</strong> (tương đương 1500 lần/phút). Chúng tôi áp dụng quy tắc 15 lần gọi/ngày để đảm bảo tính ổn định và tránh lạm dụng.</li>
                            <li>Bạn có thể thêm nhiều key trong phần "Quản lý API Keys" (đối với gói tự quản) để tăng tổng hạn ngạch.</li>
                        </ul>
                    </div>
                </div>
                 <div className="p-4 bg-gray-900/50 text-right rounded-b-xl border-t border-gray-700">
                    <button onClick={onClose} className="px-5 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 text-sm font-medium">Đóng</button>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionModal;