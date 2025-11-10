import React from 'react';
// FIX: Add file extensions to imports to resolve module loading errors.
import { SubscriptionTier } from '@/types.ts';
import { TIER_LIMITS } from '@/constants.ts';
import { CheckIcon, StarIcon, InfoIcon } from '@/components/Icons.tsx';

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
        price: '49,000 VNĐ',
        originalPrice: '79,000 VNĐ',
        discount: 'GIẢM 38%',
        description: 'Dành cho người dùng thường xuyên cần giới hạn nhập liệu cao hơn.',
        limit: TIER_LIMITS[SubscriptionTier.PRO],
        features: [
            'Yêu cầu API Key Gemini riêng',
            'Giới hạn ký tự nhập liệu cao hơn',
            'Hỗ trợ ưu tiên'
        ],
        style: {
            bg: 'bg-cyan-900/50',
            border: 'border-cyan-500',
            button: 'bg-cyan-600 hover:bg-cyan-700'
        }
    },
    [SubscriptionTier.ULTRA]: {
        kind: 'standard' as const,
        name: 'Ultra',
        price: '99,000 VNĐ',
        originalPrice: '149,000 VNĐ',
        discount: 'GIẢM 34%',
        description: 'Giải pháp toàn diện cho doanh nghiệp và người dùng chuyên nghiệp.',
        limit: TIER_LIMITS[SubscriptionTier.ULTRA],
        features: [
            'Yêu cầu API Key Gemini riêng',
            'Giới hạn ký tự nhập liệu không giới hạn',
            'Tất cả tính năng của gói Pro',
            'Hỗ trợ ưu tiên cao nhất',
        ],
        style: {
            bg: 'bg-teal-900/50',
            border: 'border-teal-500',
            button: 'bg-teal-600 hover:bg-teal-700'
        }
    },
    [SubscriptionTier.STAR]: {
        kind: 'managed' as const,
        name: 'Star',
        price: '69,000 VNĐ',
        originalPrice: '99,000 VNĐ',
        discount: 'GIẢM 30%',
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
        price: '129,000 VNĐ',
        originalPrice: '199,000 VNĐ',
        discount: 'GIẢM 35%',
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
        price: '249,000 VNĐ',
        originalPrice: '399,000 VNĐ',
        discount: 'GIẢM 38%',
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
            <div className={`flex flex-col rounded-lg p-2 border-2 ${details.style.border} ${details.style.bg} relative`}>
                 {details.kind === 'managed' && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-500 to-purple-500 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 text-white shadow-lg">
                        <StarIcon className="w-4 h-4" />
                        API Được Quản Lý
                    </div>
                )}
                <h3 className="text-sm font-bold text-white text-center pt-2">{details.name}</h3>
                <p className="text-center text-gray-400 mt-1 text-xs leading-tight">{details.description}</p>

                {/* Price Block */}
                <div className="my-1 text-center">
                    {tier === SubscriptionTier.BASIC ? (
                        <span className="text-2xl font-extrabold text-white">Miễn phí</span>
                    ) : (
                        <>
                            <div className="flex items-baseline justify-center gap-2">
                                <span className="text-2xl font-extrabold text-white">{details.price}</span>
                                {'originalPrice' in details && <s className="text-base text-gray-500">{details.originalPrice}</s>}
                            </div>
                            <span className="block text-xs font-medium text-gray-400 mb-1">/ tháng</span>
                            {'discount' in details && (
                                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                    {details.discount}
                                </span>
                            )}
                        </>
                    )}
                </div>

                {/* Limit Info Block */}
                <div className="my-1 text-center min-h-[40px] flex flex-col justify-center">
                    {details.kind === 'managed' ? (
                        <>
                            <span className="text-base font-bold text-white">{details.limitText}</span>
                            <span className="block text-xs font-medium text-gray-400">{details.subtext}</span>
                        </>
                    ) : details.kind === 'standard' ? (
                         <>
                            <span className="text-base font-bold text-white">{details.limit === Infinity ? 'Vô hạn' : details.limit.toLocaleString()}</span>
                            <span className="block text-xs font-medium text-gray-400">ký tự / lần nhập</span>
                        </>
                    ) : null}
                </div>


                <ul className="space-y-0.5 text-gray-300 text-xs my-1">
                    {details.features.map((feature, index) => (
                        <li key={index} className="flex items-start">
                            <CheckIcon className="w-4 h-4 text-green-400 mr-2 flex-shrink-0 mt-0.5" />
                            <span>{feature}</span>
                        </li>
                    ))}
                </ul>

                {isCurrentUserTier ? (
                    <button
                        disabled
                        className={`w-full mt-auto py-1 px-4 rounded-md font-semibold text-white text-sm transition-colors ${details.style.button}`}
                    >
                        Gói Hiện Tại
                    </button>
                ) : (
                     <a
                        href="https://zalo.me/0985351304"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block text-center w-full mt-auto py-1 px-4 rounded-md font-semibold text-white text-sm transition-colors ${details.style.button}`}
                    >
                        Liên hệ Nâng cấp
                    </a>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-6xl relative animate-fade-in" onClick={e => e.stopPropagation()}>
                <style>{`
                    @keyframes fade-in {
                        from { opacity: 0; transform: scale(0.95); }
                        to { opacity: 1; transform: scale(1); }
                    }
                    .animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
                `}</style>
                <div className="p-3 text-center border-b border-gray-700">
                    <h2 className="text-xl font-bold text-white">Các Gói Dịch Vụ</h2>
                    <p className="text-gray-400 mt-1 text-sm">Chọn gói phù hợp nhất với nhu cầu sử dụng của bạn.</p>
                </div>

                <div className="p-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                        <PlanCard tier={SubscriptionTier.BASIC} />
                        <PlanCard tier={SubscriptionTier.PRO} />
                        <PlanCard tier={SubscriptionTier.ULTRA} />
                        <PlanCard tier={SubscriptionTier.STAR} />
                        <PlanCard tier={SubscriptionTier.SUPER_STAR} />
                        <PlanCard tier={SubscriptionTier.VVIP} />
                    </div>

                    <div className="mt-3 p-3 bg-gray-800/50 border border-gray-700 rounded-lg text-sm space-y-3">
                        <h4 className="font-bold text-cyan-400 flex items-center gap-2 text-base">
                            <InfoIcon className="h-5 w-5" />
                            Giải thích về Giới hạn & Hạn ngạch
                        </h4>
                        <div>
                           <strong className="text-gray-200">Gói Tự quản (Basic, Pro, Ultra):</strong>
                           <ul className="list-disc list-inside text-gray-300 space-y-1 mt-1 pl-2">
                                <li><strong>Giới hạn ký tự</strong> áp dụng cho độ dài của một lần nhập liệu.</li>
                                <li>Để xử lý văn bản dài, ứng dụng sẽ tự động <strong className="text-yellow-300">chia nhỏ thành nhiều phần</strong>.</li>
                                <li><strong className="text-red-400">Quan trọng:</strong> Mỗi phần được xử lý sẽ được tính là <strong className="text-red-400">một lần gọi API</strong>, trừ vào hạn ngạch hàng ngày của API key bạn cung cấp.</li>
                           </ul>
                        </div>
                         <div>
                            <strong className="text-gray-200">Gói Được quản lý (Star, Super Star & VVIP):</strong>
                            <ul className="list-disc list-inside text-gray-300 space-y-1 mt-1 pl-2">
                                <li><strong>Giới hạn ký tự và Lượt tạo</strong> áp dụng cho tổng số lượng bạn có thể xử lý trong một ngày.</li>
                                <li>Hạn ngạch sẽ hết khi bạn đạt đến giới hạn ký tự <strong className="text-yellow-300">HOẶC</strong> lượt tạo, tùy điều kiện nào đến trước.</li>
                           </ul>
                        </div>
                        <div>
                            <strong className="text-gray-200">Làm mới Hạn ngạch API:</strong>
                            <ul className="list-disc list-inside text-gray-300 space-y-1 mt-1 pl-2">
                                <li>Hạn ngạch miễn phí của mỗi API Key (~15 lượt gọi/ngày) sẽ được <strong className="text-green-400">làm mới vào lúc 15:00 (3 giờ chiều) mỗi ngày</strong> theo giờ Việt Nam.</li>
                           </ul>
                        </div>
                    </div>
                </div>
                 <div className="p-3 bg-gray-900/50 text-right rounded-b-xl border-t border-gray-700">
                    <button onClick={onClose} className="px-5 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 text-sm font-medium">Đóng</button>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionModal;