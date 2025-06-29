/**
 * LandingPage component - The main landing page for the Standup-Sync application.
 *
 * Features:
 * - Hero section introducing the product and a call-to-action button.
 * - Animated feature cards highlighting core features such as AI feedback, real-time attendance, admin controls, and Firebase integration.
 * - "Why Stand Out" section explaining the architecture and unique benefits.
 * - Responsive design with framer-motion animations for engaging transitions.
 * - Custom SVG illustrations for visual appeal.
 * - Footer with copyright.
 *
 * Sub-components:
 * - FeatureCard: Displays an individual feature with icon, title, description, and action button.
 * - BenefitItem: Lists a benefit with icon, title, and description.
 * - FirebaseLogo, HeroIllustration, StandOutIllustration: SVG illustrations used in the UI.
 *
 * @component
 * @returns {JSX.Element} The rendered landing page.
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowRight, BrainCircuit, CheckSquare, ShieldCheck, KeyRound, FileSpreadsheet } from 'lucide-react';
import { motion, easeOut } from 'framer-motion'; // --- IMPORT FRAMER MOTION ---

// --- Animation Variants ---
const sectionVariant = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easeOut } }
};

const cardVariant = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0 }
};


// --- Main Landing Page Component ---
export default function LandingPage() {
    const navigate = useNavigate();

    const handleNavigateToAuth = () => {
        navigate('/auth');
    };

    return (
        <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
            <main className="flex-1">
                {/* Section 1: Hero */}
                <section className="container mx-auto px-4 py-20 sm:py-32">
                    <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-12">
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="text-center lg:text-left"
                        >
                            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight">
                                AI-Powered Team Sync, Simplified.
                            </h1>
                            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto lg:mx-0">
                                Welcome to Standup-Sync. Streamline team standups and get deep, AI-driven insights into employee feedback with a secure, scalable platform built on Firebase.
                            </p>
                            <Button size="lg" className="mt-8" onClick={handleNavigateToAuth}>
                                Get Started <ArrowRight className="ml-2 h-5 w-5" />
                            </Button>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                            className="flex items-center justify-center"
                        >
                            <HeroIllustration className="w-full max-w-lg" />
                        </motion.div>
                    </div>
                </section>

                {/* Section 2: Core Features */}
                <motion.section
                    variants={sectionVariant}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.2 }}
                    className="bg-secondary/50 py-20 sm:py-24"
                >
                    <div className="container mx-auto px-4">
                        <h2 className="text-3xl sm:text-4xl font-bold text-center">Core Features of Standup-Sync</h2>
                        <motion.div
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true, amount: 0.2 }}
                            transition={{ staggerChildren: 0.15 }}
                            className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8"
                        >
                            <FeatureCard
                                icon={<BrainCircuit className="h-8 w-8 text-primary" />}
                                title="AI Feedback Dashboard"
                                description="Analyze feedback from Google Sheets with the Gemini AI to uncover actionable insights, positive themes, and areas for improvement."
                                onButtonClick={handleNavigateToAuth}
                            />
                            <FeatureCard
                                icon={<CheckSquare className="h-8 w-8 text-primary" />}
                                title="Real-Time Attendance"
                                description="Track team participation in real-time during standups. Manually edit records and sync everything to Google Sheets for safekeeping."
                                onButtonClick={handleNavigateToAuth}
                            />
                            <FeatureCard
                                icon={<ShieldCheck className="h-8 w-8 text-primary" />}
                                title="Secure Admin Controls"
                                description="Manage employees, schedule standups, and promote users, all protected by Firebase Custom Claims for role-based access."
                                onButtonClick={handleNavigateToAuth}
                            />
                            <FeatureCard
                                icon={<FirebaseLogo className="h-8 w-8" />}
                                title="Built on Firebase"
                                description="Leveraging the full power of Firebase for authentication, serverless functions, and a real-time database for a secure experience."
                                onButtonClick={handleNavigateToAuth}
                                isDark
                            />
                        </motion.div>
                    </div>
                </motion.section>

                {/* Section 3: Why Stand Out */}
                <section className="container mx-auto px-4 py-20 sm:py-32">
                    <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-16">
                        <motion.div
                            initial={{ opacity: 0, x: 50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, amount: 0.3 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="flex items-center justify-center"
                        >
                            <StandOutIllustration className="w-full max-w-md" />
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, x: -50 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, amount: 0.3 }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                            className="lg:order-first"
                        >
                            <h2 className="text-3xl sm:text-4xl font-bold">The Standup-Sync Architecture</h2>
                            <p className="mt-4 text-muted-foreground">
                                A secure and efficient architecture with a clear separation between the client (React) and the secure backend (Firebase Cloud Functions).
                            </p>
                            <div className="mt-8 space-y-6">
                                <BenefitItem
                                    icon={<FileSpreadsheet className="h-6 w-6 text-primary" />}
                                    title="Seamless Google Integration"
                                    description="Connect directly to private Google Sheets for feedback analysis and attendance syncing, all authenticated via a secure service account."
                                />
                                <BenefitItem
                                    icon={<KeyRound className="h-6 w-6 text-primary" />}
                                    title="Secure by Design"
                                    description="Distinct roles for Team Members and Admins are enforced with Firebase Custom Claims, ensuring users only see what they need to."
                                />
                                <BenefitItem
                                    icon={<BrainCircuit className="h-6 w-6 text-primary" />}
                                    title="Go Beyond Data"
                                    description="Don't just collect feedback, understand it. Our Gemini-powered dashboard turns raw comments into structured, actionable intelligence."
                                />
                            </div>
                        </motion.div>
                    </div>
                </section>
            </main>

            <footer className="py-8 border-t">
                <div className="container mx-auto px-4 text-center text-muted-foreground">
                    <p>&copy; {new Date().getFullYear()} Standup-Sync. All Rights Reserved.</p>
                </div>
            </footer>
        </div>
    );
}


// --- Reusable Sub-components ---

interface FeatureCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    isDark?: boolean;
    onButtonClick: () => void;
}

function FeatureCard({ icon, title, description, isDark = false, onButtonClick }: FeatureCardProps) {
    const cardClasses = isDark ? 'bg-primary text-primary-foreground' : 'bg-card';
    const titleClasses = isDark ? 'text-primary-foreground' : 'text-card-foreground';
    const descriptionClasses = isDark ? 'text-primary-foreground/80' : 'text-muted-foreground';

    return (
        <motion.div variants={cardVariant}>
            <Card className={`text-center h-full p-8 flex flex-col items-center shadow-sm hover:shadow-lg transition-shadow duration-300 ${cardClasses}`}>
                <div className={`mb-5 p-4 rounded-full ${isDark ? 'bg-primary-foreground/10' : 'bg-secondary'}`}>{icon}</div>
                <h3 className={`text-xl font-semibold ${titleClasses}`}>{title}</h3>
                <p className={`mt-2 text-sm flex-grow ${descriptionClasses}`}>
                    {description}
                </p>
                <Button variant={isDark ? 'secondary' : 'default'} className="mt-6 w-full" onClick={onButtonClick}>
                    {isDark ? 'Learn More' : 'Get Started'}
                </Button>
            </Card>
        </motion.div>
    );
}

interface BenefitItemProps {
    icon: React.ReactNode;
    title: string;
    description: string;
}

function BenefitItem({ icon, title, description }: BenefitItemProps) {
    return (
        <div className="flex items-start gap-4">
            <div className="flex-shrink-0 bg-secondary p-3 rounded-full">{icon}</div>
            <div>
                <h4 className="font-semibold text-lg">{title}</h4>
                <p className="mt-1 text-muted-foreground">{description}</p>
            </div>
        </div>
    );
}


// --- SVG Illustrations ---

function FirebaseLogo(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" {...props}>
            <path d="M96.7 64.9L32.2 3.3c-1-1-2.6-.9-3.4.2L20 16.2c-.8 1.1-.7 2.7.2 3.6l34.8 34.8-35 35c-1 1-.9 2.6.2 3.4l8.8 12.7c.8 1.1 2.3 1.2 3.4.2l64.5-61.6c1.2-1 .9-2.8-.2-3.6z" fill="#FFC24A" />
            <path d="M96.7 64.9L64.4 97.2c-1 1-1.2 2.6-.3 3.6L73 113.5c.8 1 2.3 1 3.4.2l41.6-41.6c1-1 .9-2.6-.2-3.6L99.9 52c-1.1-.9-2.7-.8-3.6.2l-2.8 2.8c-.5.5-.6 1.3-.1 1.9z" fill="#FFA000" />
            <path d="M54.9 87.1c-1.6 1.6-1.6 4.1 0 5.7l8 8c1.6 1.6 4.1 1.6 5.7 0l28.1-28.1c1.6-1.6 1.6-4.1 0-5.7l-8-8c-1.6-1.6-4.1-1.6-5.7 0L54.9 87.1z" fill="#F47B00" />
            <path d="M28.8 19.8l34.9 34.9L28.8 89.6c-2.3 2.3-1.4 6.4 1.8 7.6l8.8 3.4c3.2 1.2 6.5-1.1 7.6-4.3l35-89.6c1.2-3.2-1.1-6.5-4.3-7.6l-8.8-3.4c-3.2-1.2-6.5 1.1-7.6 4.3z" fill="#424242" opacity=".2" />
        </svg>
    );
}

function HeroIllustration(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 450 350" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="50" y="100" width="300" height="180" rx="12" />
                <path d="M150 280 L250 280" />
                <path d="M200 280 L200 310" />
                <path d="M170 310 L230 310" />
                <circle cx="350" cy="80" r="30" />
                <path d="M350 110 C 350 150, 320 180, 280 180" />
                <path d="M365 70 C 375 75, 380 85, 375 95" />
                <rect x="80" y="130" width="100" height="60" fill="currentColor" fillOpacity="0.1" />
                <rect x="190" y="140" width="80" height="40" rx="4" fill="currentColor" fillOpacity="0.1" />
                <path d="M280 120 L320 100 L300 140z" fill="currentColor" fillOpacity="0.1" />
                <circle cx="130" cy="220" r="15" fill="currentColor" fillOpacity="0.1" />
            </g>
        </svg>
    );
}

function StandOutIllustration(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 450 350" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="100" cy="100" r="30" />
                <path d="M100 130 C 100 180, 70 200, 50 220" />
                <circle cx="200" cy="90" r="30" />
                <path d="M200 120 C 200 170, 180 190, 150 210" />
                <path d="M200 120 C 200 170, 220 190, 250 210" />
                <circle cx="300" cy="100" r="30" />
                <path d="M300 130 C 300 180, 330 200, 350 220" />
                <path d="M130 140 C 180 120, 250 120, 270 140" />
                <path d="M70 140 C 20 160, 40 200, 80 180" />
                <path d="M330 140 C 380 160, 360 200, 320 180" />
            </g>
        </svg>
    );
}
