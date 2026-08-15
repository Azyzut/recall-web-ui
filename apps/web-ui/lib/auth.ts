'use client'

interface User {
  id: string
  email: string
  createdAt: Date
}

interface AuthResult {
  success: boolean
  message?: string
  error?: string
  user?: User
}

class AuthService {
  private readonly STORAGE_KEY = 'recall_tracker_auth_session'
  private readonly MOCK_VERIFICATION_CODE = '123456'

  async sendMagicLink(email: string): Promise<AuthResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Invalid email format' }
    }

    console.log(`[AUTH STUB] Sending magic link to ${email}`)
    console.log(`[AUTH STUB] Verification code: ${this.MOCK_VERIFICATION_CODE}`)
    
    // Store email temporarily for verification
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('pending_email', email)
    }
    
    return {
      success: true,
      message: `Magic link sent to ${email}. Check console for verification code.`
    }
  }

  async verifyMagicLink(token: string): Promise<AuthResult> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    console.log(`[AUTH STUB] Verifying magic link token: ${token}`)
    
    if (token !== this.MOCK_VERIFICATION_CODE) {
      return { success: false, error: 'Invalid verification code' }
    }
    
    // Get stored email
    const email = typeof window !== 'undefined' ? sessionStorage.getItem('pending_email') : null
    if (!email) {
      return { success: false, error: 'Session expired. Please request a new magic link.' }
    }
    
    // Create mock user session
    const user: User = {
      id: Math.random().toString(36).substr(2, 9),
      email: email,
      createdAt: new Date()
    }
    
    // Store session
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(user))
      sessionStorage.removeItem('pending_email')
    }
    
    return {
      success: true,
      user,
      message: 'Successfully authenticated'
    }
  }

  async getCurrentUser(): Promise<User | null> {
    if (typeof window === 'undefined') {
      return null
    }
    
    try {
      const sessionData = localStorage.getItem(this.STORAGE_KEY)
      if (!sessionData) {
        return null
      }
      
      const user = JSON.parse(sessionData)
      // Convert createdAt string back to Date object
      user.createdAt = new Date(user.createdAt)
      
      return user
    } catch (error) {
      console.error('[AUTH STUB] Failed to parse stored session:', error)
      return null
    }
  }

  async signOut(): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY)
      sessionStorage.removeItem('pending_email')
    }
    console.log('[AUTH STUB] Signing out user')
  }

  isAuthenticated(): boolean {
    return this.getCurrentUser() !== null
  }
}

export const auth = new AuthService()