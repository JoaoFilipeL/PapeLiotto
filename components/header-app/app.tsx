'use client'

import type React from "react"
import { UserProfileProvider } from "../context/user-profile-context"
import { NavBar } from "../header-app/nav-bar"
import Header from "../header-app/header"

interface AppProps {
    children: React.ReactNode
}

export function App({ children }: AppProps) {
    return (
        <UserProfileProvider>
            <div className="flex flex-col h-screen bg-black text-white">
                <Header />
                <NavBar className="p-4" />
                <div className="flex flex-1 overflow-hidden">
                    <main className={`flex-1 p-4 md:p-6 lg:p-8 overflow-y-auto rounded-tl-xl transition-all duration-300 ease-in-out`}>
                        {children}
                    </main>
                </div>
            </div>
        </UserProfileProvider>
    )
}