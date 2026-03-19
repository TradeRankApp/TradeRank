import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://mihvytohmagbggmgpuxf.supabase.co'
const SUPABASE_KEY = 'sb_publishable_k6X3GjAgUMKG3bZvTo4iow_r9YHJZGi'

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ── Auth helpers ──────────────────────────────────────────────────────────────
export const signUp = async (email, password, handle, category) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { handle, category }
    }
  })
  if (error) throw error

  // Create profile row
  if (data.user) {
    await supabase.from('profiles').insert({
      id: data.user.id,
      handle: handle.toUpperCase(),
      email,
      category,
      verified: false,
      supporter: false,
      trader_score: 0,
      net_return: 0,
      max_drawdown: 0,
      win_rate: 0,
      trade_count: 0,
      followers: 0,
      following: 0,
      bio: ''
    })
  }
  return data
}

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export const signOut = async () => {
  await supabase.auth.signOut()
}

export const getSession = async () => {
  const { data } = await supabase.auth.getSession()
  return data.session
}

// ── Profile helpers ───────────────────────────────────────────────────────────
export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) return null
  return data
}

export const getAllProfiles = async () => {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .order('trader_score', { ascending: false })
  return data || []
}

export const updateProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Posts helpers ─────────────────────────────────────────────────────────────
export const getPosts = async () => {
  const { data } = await supabase
    .from('posts')
    .select('*')
    .order('created_at', { ascending: false })
  return data || []
}

export const createPost = async (post) => {
  const { data, error } = await supabase
    .from('posts')
    .insert(post)
    .select()
    .single()
  if (error) throw error
  return data
}

export const likePost = async (postId, currentLikes) => {
  const { error } = await supabase
    .from('posts')
    .update({ likes: currentLikes + 1 })
    .eq('id', postId)
  if (error) throw error
}

// ── Strategies helpers ────────────────────────────────────────────────────────
export const getStrategies = async () => {
  const { data } = await supabase
    .from('strategies')
    .select('*')
    .order('featured', { ascending: false })
  return data || []
}

export const createStrategy = async (strategy) => {
  const { data, error } = await supabase
    .from('strategies')
    .insert(strategy)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── Purchases helpers ─────────────────────────────────────────────────────────
export const createPurchase = async (buyerId, sellerId, strategyId, amount) => {
  const platformFee = amount * 0.15
  const sellerPayout = amount * 0.85

  const { data, error } = await supabase
    .from('purchases')
    .insert({
      buyer_id: buyerId,
      seller_id: sellerId,
      strategy_id: strategyId,
      amount,
      platform_fee: platformFee,
      seller_payout: sellerPayout,
      status: 'completed'
    })
    .select()
    .single()
  if (error) throw error

  // Increment sales count on strategy
  await supabase.rpc('increment_sales', { strategy_id: strategyId })

  return data
}

export const getUserPurchases = async (userId) => {
  const { data } = await supabase
    .from('purchases')
    .select('strategy_id')
    .eq('buyer_id', userId)
  return data?.map(p => p.strategy_id) || []
}

// ── Follows helpers ───────────────────────────────────────────────────────────
export const followTrader = async (followerId, followingId) => {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId, type: 'trader' })
  if (error) throw error
}

export const unfollowTrader = async (followerId, followingId) => {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
  if (error) throw error
}

export const getUserFollowing = async (userId) => {
  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)
    .eq('type', 'trader')
  return data?.map(f => f.following_id) || []
}
