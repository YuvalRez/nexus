import Link from "next/link";
import { ArrowRight, BookOpen, Lock, Users } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary-500" />
            <span className="text-xl font-bold">Nexus</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium hover:text-primary-400 transition-colors">
              Log in
            </Link>
            <Link
              href="/signup"
              className="text-sm font-medium bg-primary-600 text-white px-4 py-2 rounded-xl hover:bg-primary-700 transition-colors"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 py-20 relative overflow-hidden">
        {/* Background Gradients */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary-500/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
        
        <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 animate-fade-in-up">
          Your Knowledge, <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-600">
            Beautifully Organized.
          </span>
        </h1>
        
        <p className="text-lg md:text-xl text-foreground/70 max-w-2xl mb-10 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          Nexus is the secure, drag-and-drop markdown platform built for teams who value clean documentation and seamless collaboration.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
          <Link
            href="/signup"
            className="flex items-center gap-2 bg-primary-600 text-white px-8 py-4 rounded-full font-medium text-lg hover:bg-primary-700 hover:scale-105 transition-all shadow-lg shadow-primary-500/25"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-2 bg-foreground/5 text-foreground px-8 py-4 rounded-full font-medium text-lg hover:bg-foreground/10 transition-all"
          >
            Go to Dashboard
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-32 max-w-5xl w-full text-left animate-fade-in-up" style={{ animationDelay: '300ms' }}>
          <div className="bg-card border border-border p-8 rounded-3xl relative overflow-hidden group hover:border-primary-500/50 transition-colors">
            <div className="w-12 h-12 bg-primary-500/10 rounded-2xl flex items-center justify-center mb-6 text-primary-500">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-3">Rich Markdown</h3>
            <p className="text-foreground/70 leading-relaxed">
              Drag and drop any Markdown file. Nexus automatically renders it beautifully with full syntax highlighting and formatting.
            </p>
          </div>
          
          <div className="bg-card border border-border p-8 rounded-3xl relative overflow-hidden group hover:border-primary-500/50 transition-colors">
            <div className="w-12 h-12 bg-primary-500/10 rounded-2xl flex items-center justify-center mb-6 text-primary-500">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-3">Secure by Default</h3>
            <p className="text-foreground/70 leading-relaxed">
              Your notes are completely private. Invite specific team members with read-only access to securely share knowledge.
            </p>
          </div>

          <div className="bg-card border border-border p-8 rounded-3xl relative overflow-hidden group hover:border-primary-500/50 transition-colors">
            <div className="w-12 h-12 bg-primary-500/10 rounded-2xl flex items-center justify-center mb-6 text-primary-500">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold mb-3">Seamless Teams</h3>
            <p className="text-foreground/70 leading-relaxed">
              Create dedicated workspaces for different projects. Manage who has access to what, all in one simple interface.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
