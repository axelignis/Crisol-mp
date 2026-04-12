export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      artisan: {
        Row: {
          bio: string | null
          created_at: string
          id: string
          instagram: string | null
          is_suspended: boolean
          photo_url: string | null
          slug: string | null
          stripe_account_id: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          is_suspended?: boolean
          photo_url?: string | null
          slug?: string | null
          stripe_account_id?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          id?: string
          instagram?: string | null
          is_suspended?: boolean
          photo_url?: string | null
          slug?: string | null
          stripe_account_id?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "artisan_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      artisan_follower: {
        Row: {
          artisan_id: string
          buyer_id: string
          followed_at: string
        }
        Insert: {
          artisan_id: string
          buyer_id: string
          followed_at?: string
        }
        Update: {
          artisan_id?: string
          buyer_id?: string
          followed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artisan_follower_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisan_follower_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyer"
            referencedColumns: ["id"]
          },
        ]
      }
      artisan_payout: {
        Row: {
          artisan_id: string
          commission_amount: number
          created_at: string
          gross_amount: number
          id: string
          net_amount: number
          notes: string | null
          paid_at: string | null
          paid_by: string | null
          period_from: string
          period_to: string
          status: string
          stripe_payout_id: string | null
          stripe_transfer_ids: Json | null
          updated_at: string
        }
        Insert: {
          artisan_id: string
          commission_amount: number
          created_at?: string
          gross_amount: number
          id?: string
          net_amount: number
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          period_from: string
          period_to: string
          status?: string
          stripe_payout_id?: string | null
          stripe_transfer_ids?: Json | null
          updated_at?: string
        }
        Update: {
          artisan_id?: string
          commission_amount?: number
          created_at?: string
          gross_amount?: number
          id?: string
          net_amount?: number
          notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          period_from?: string
          period_to?: string
          status?: string
          stripe_payout_id?: string | null
          stripe_transfer_ids?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "artisan_payout_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "artisan_payout_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_post: {
        Row: {
          author_id: string
          content: string | null
          created_at: string
          excerpt: string | null
          featured_image_url: string | null
          id: string
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          published_at: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content?: string | null
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          published_at?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string | null
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          published_at?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_post_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      buyer: {
        Row: {
          created_at: string
          id: string
          level_since: string | null
          membership_level_id: string | null
          total_points: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          level_since?: string | null
          membership_level_id?: string | null
          total_points?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          level_since?: string | null
          membership_level_id?: string | null
          total_points?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_membership_level_fkey"
            columns: ["membership_level_id"]
            isOneToOne: false
            referencedRelation: "membership_level"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "buyer_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      category: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          parent_id: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "category_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_config: {
        Row: {
          commission_pct: number
          created_by: string | null
          effective_from: string
          free_shipping_threshold: number
          id: string
          notes: string | null
          points_per_purchase: number
          points_to_clp_rate: number
        }
        Insert: {
          commission_pct?: number
          created_by?: string | null
          effective_from?: string
          free_shipping_threshold?: number
          id?: string
          notes?: string | null
          points_per_purchase?: number
          points_to_clp_rate?: number
        }
        Update: {
          commission_pct?: number
          created_by?: string | null
          effective_from?: string
          free_shipping_threshold?: number
          id?: string
          notes?: string | null
          points_per_purchase?: number
          points_to_clp_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "commission_config_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_slot: {
        Row: {
          artisan_id: string
          created_at: string
          description: string | null
          estimated_days: number
          id: string
          is_available: boolean
          max_slots: number
          price: number
          reserved_slots: number
          title: string
          updated_at: string
        }
        Insert: {
          artisan_id: string
          created_at?: string
          description?: string | null
          estimated_days?: number
          id?: string
          is_available?: boolean
          max_slots?: number
          price: number
          reserved_slots?: number
          title: string
          updated_at?: string
        }
        Update: {
          artisan_id?: string
          created_at?: string
          description?: string | null
          estimated_days?: number
          id?: string
          is_available?: boolean
          max_slots?: number
          price?: number
          reserved_slots?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commission_slot_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisan"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          min_order: number | null
          uses_count: number
          uses_limit: number | null
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          min_order?: number | null
          uses_count?: number
          uses_limit?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          min_order?: number | null
          uses_count?: number
          uses_limit?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_transaction: {
        Row: {
          balance_after: number
          buyer_id: string
          created_at: string
          description: string | null
          id: string
          order_id: string | null
          points_delta: number
          type: string
        }
        Insert: {
          balance_after: number
          buyer_id: string
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          points_delta: number
          type: string
        }
        Update: {
          balance_after?: number
          buyer_id?: string
          created_at?: string
          description?: string | null
          id?: string
          order_id?: string | null
          points_delta?: number
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_transaction_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_transaction_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_level: {
        Row: {
          commission_discount: boolean
          created_at: string
          discount_pct: number
          early_access: boolean
          free_shipping: boolean
          id: string
          name: string
          points_threshold: number
          sort_order: number
        }
        Insert: {
          commission_discount?: boolean
          created_at?: string
          discount_pct?: number
          early_access?: boolean
          free_shipping?: boolean
          id?: string
          name: string
          points_threshold?: number
          sort_order?: number
        }
        Update: {
          commission_discount?: boolean
          created_at?: string
          discount_pct?: number
          early_access?: boolean
          free_shipping?: boolean
          id?: string
          name?: string
          points_threshold?: number
          sort_order?: number
        }
        Relationships: []
      }
      notification: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      order: {
        Row: {
          buyer_id: string | null
          commission_amount: number
          commission_pct_snapshot: number | null
          coupon_id: string | null
          created_at: string
          discount_amount: number
          guest_email: string | null
          guest_name: string | null
          id: string
          notes: string | null
          points_redeemed: number
          shipping_cost: number
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        Insert: {
          buyer_id?: string | null
          commission_amount?: number
          commission_pct_snapshot?: number | null
          coupon_id?: string | null
          created_at?: string
          discount_amount?: number
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          notes?: string | null
          points_redeemed?: number
          shipping_cost?: number
          status?: string
          subtotal: number
          total: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string | null
          commission_amount?: number
          commission_pct_snapshot?: number | null
          coupon_id?: string | null
          created_at?: string
          discount_amount?: number
          guest_email?: string | null
          guest_name?: string | null
          id?: string
          notes?: string | null
          points_redeemed?: number
          shipping_cost?: number
          status?: string
          subtotal?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupon"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item: {
        Row: {
          artisan_id: string
          commission_slot_id: string | null
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          quantity: number
          snapshot_sku: string | null
          snapshot_title: string
          total_price: number
          unit_price: number
          variant_id: string | null
        }
        Insert: {
          artisan_id: string
          commission_slot_id?: string | null
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          quantity?: number
          snapshot_sku?: string | null
          snapshot_title: string
          total_price: number
          unit_price: number
          variant_id?: string | null
        }
        Update: {
          artisan_id?: string
          commission_slot_id?: string | null
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          snapshot_sku?: string | null
          snapshot_title?: string
          total_price?: number
          unit_price?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_item_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_commission_slot_id_fkey"
            columns: ["commission_slot_id"]
            isOneToOne: false
            referencedRelation: "commission_slot"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variant"
            referencedColumns: ["id"]
          },
        ]
      }
      payment: {
        Row: {
          amount: number
          artisan_net: number
          coinbase_charge_id: string | null
          commission_amount: number
          created_at: string
          id: string
          method: string
          order_id: string
          paid_at: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_transfer_id: string | null
          updated_at: string
        }
        Insert: {
          amount: number
          artisan_net: number
          coinbase_charge_id?: string | null
          commission_amount: number
          created_at?: string
          id?: string
          method: string
          order_id: string
          paid_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number
          artisan_net?: number
          coinbase_charge_id?: string | null
          commission_amount?: number
          created_at?: string
          id?: string
          method?: string
          order_id?: string
          paid_at?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_transfer_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
        ]
      }
      product: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          artisan_id: string
          base_price: number
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          is_unique: boolean
          is_visible: boolean
          published_at: string | null
          rejection_notes: string | null
          slug: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          artisan_id: string
          base_price: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_unique?: boolean
          is_visible?: boolean
          published_at?: string | null
          rejection_notes?: string | null
          slug: string
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          artisan_id?: string
          base_price?: number
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_unique?: boolean
          is_visible?: boolean
          published_at?: string | null
          rejection_notes?: string | null
          slug?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          cloudinary_id: string | null
          created_at: string
          id: string
          is_cover: boolean
          product_id: string
          sort_order: number
          type: string
          url: string
        }
        Insert: {
          cloudinary_id?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          product_id: string
          sort_order?: number
          type: string
          url: string
        }
        Update: {
          cloudinary_id?: string | null
          created_at?: string
          id?: string
          is_cover?: boolean
          product_id?: string
          sort_order?: number
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tag: {
        Row: {
          product_id: string
          tag_id: string
        }
        Insert: {
          product_id: string
          tag_id: string
        }
        Update: {
          product_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tag_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tag_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tag"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variant: {
        Row: {
          color: string | null
          created_at: string
          id: string
          is_available: boolean
          material: string | null
          price_modifier: number
          product_id: string
          size: string | null
          sku: string | null
          stock: number
          stones: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          is_available?: boolean
          material?: string | null
          price_modifier?: number
          product_id: string
          size?: string | null
          sku?: string | null
          stock?: number
          stones?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          is_available?: boolean
          material?: string | null
          price_modifier?: number
          product_id?: string
          size?: string | null
          sku?: string | null
          stock?: number
          stones?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variant_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
        ]
      }
      review: {
        Row: {
          buyer_id: string
          comment: string | null
          created_at: string
          id: string
          is_approved: boolean
          moderated_at: string | null
          moderated_by: string | null
          order_id: string
          product_id: string
          rating: number
        }
        Insert: {
          buyer_id: string
          comment?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          moderated_at?: string | null
          moderated_by?: string | null
          order_id: string
          product_id: string
          rating: number
        }
        Update: {
          buyer_id?: string
          comment?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean
          moderated_at?: string | null
          moderated_by?: string | null
          order_id?: string
          product_id?: string
          rating?: number
        }
        Relationships: [
          {
            foreignKeyName: "review_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_moderated_by_fkey"
            columns: ["moderated_by"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_meta: {
        Row: {
          canonical_url: string | null
          entity_id: string
          entity_type: string
          hreflang: Json | null
          id: string
          meta_description: string | null
          meta_title: string | null
          og_image_url: string | null
          schema_json: Json | null
          updated_at: string
        }
        Insert: {
          canonical_url?: string | null
          entity_id: string
          entity_type: string
          hreflang?: Json | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          schema_json?: Json | null
          updated_at?: string
        }
        Update: {
          canonical_url?: string | null
          entity_id?: string
          entity_type?: string
          hreflang?: Json | null
          id?: string
          meta_description?: string | null
          meta_title?: string | null
          og_image_url?: string | null
          schema_json?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      shipment: {
        Row: {
          artisan_id: string
          courier: string
          created_at: string
          delivered_at: string | null
          estimated_delivery: string | null
          id: string
          order_id: string
          shipped_at: string | null
          status: string
          tracking_number: string | null
          tracking_url: string | null
          updated_at: string
        }
        Insert: {
          artisan_id: string
          courier: string
          created_at?: string
          delivered_at?: string | null
          estimated_delivery?: string | null
          id?: string
          order_id: string
          shipped_at?: string | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Update: {
          artisan_id?: string
          courier?: string
          created_at?: string
          delivered_at?: string | null
          estimated_delivery?: string | null
          id?: string
          order_id?: string
          shipped_at?: string | null
          status?: string
          tracking_number?: string | null
          tracking_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_artisan_id_fkey"
            columns: ["artisan_id"]
            isOneToOne: false
            referencedRelation: "artisan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_address: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          country_code: string
          created_at: string
          full_name: string
          id: string
          order_id: string
          phone: string | null
          postal_code: string | null
          state_province: string | null
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          country_code?: string
          created_at?: string
          full_name: string
          id?: string
          order_id: string
          phone?: string | null
          postal_code?: string | null
          state_province?: string | null
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          country_code?: string
          created_at?: string
          full_name?: string
          id?: string
          order_id?: string
          phone?: string | null
          postal_code?: string | null
          state_province?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_address_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "order"
            referencedColumns: ["id"]
          },
        ]
      }
      tag: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          type?: string
        }
        Relationships: []
      }
      user: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          locale: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          locale?: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          locale?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      webhook_event: {
        Row: {
          event_type: string
          id: string
          payload: Json | null
          processed_at: string
          source: string
        }
        Insert: {
          event_type: string
          id: string
          payload?: Json | null
          processed_at?: string
          source: string
        }
        Update: {
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string
          source?: string
        }
        Relationships: []
      }
      wishlist_item: {
        Row: {
          added_at: string
          buyer_id: string
          id: string
          product_id: string
        }
        Insert: {
          added_at?: string
          buyer_id: string
          id?: string
          product_id: string
        }
        Update: {
          added_at?: string
          buyer_id?: string
          id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_item_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "buyer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wishlist_item_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_artisan_id: { Args: never; Returns: string }
      current_buyer_id: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      transition_order_status: {
        Args: { p_actor_id: string; p_new_status: string; p_order_id: string }
        Returns: {
          buyer_id: string | null
          commission_amount: number
          commission_pct_snapshot: number | null
          coupon_id: string | null
          created_at: string
          discount_amount: number
          guest_email: string | null
          guest_name: string | null
          id: string
          notes: string | null
          points_redeemed: number
          shipping_cost: number
          status: string
          subtotal: number
          total: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "order"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      transition_product_status: {
        Args: {
          p_actor_id: string
          p_new_status: string
          p_notes?: string
          p_product_id: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          artisan_id: string
          base_price: number
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          is_unique: boolean
          is_visible: boolean
          published_at: string | null
          rejection_notes: string | null
          slug: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "product"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      unaccent: { Args: { "": string }; Returns: string }
      user_role: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

