import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Monad AI Concierge — Your intent. Your control.',
  description:'A conversational wallet for Monad Testnet. Send to saved contacts, set safeguards, and approve with a passkey.',icons:{icon:'/icon-192.png',apple:'/apple-touch-icon.png'},appleWebApp:{capable:true,title:'Concierge',statusBarStyle:'default'}};
export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
