# RBAC and Configurable Content Types - Design Document

**Date:** 2026-02-05
**Issues:** #6 (Configurable Content Types), #9 (Basic RBAC)
**Status:** Approved for Implementation

## Overview

Implement role-based access control (RBAC) with three user roles (Admin, Contributor, Reader) and make content types fully configurable by admins instead of hardcoded enums.

## Requirements

### User Roles
- **Admin**: Manage user roles, content types, queue operations, and all contributor permissions
- **Contributor**: Create, edit, delete content items, import CSV, manage campaigns
- **Reader**: Search and view content (read-only)

### Content Types
- Admins can create, edit, delete content types
- Each type has: name, slug, color (from predefined palette), display order
- Protected "Other" type that cannot be deleted (fallback for reassignments)
- Block deletion of types with existing content (with option to reassign)

### Default Role Assignment
- First user to authenticate → Admin role
- All subsequent users → Reader role by default
- Admins promote users to Contributor or Admin as needed

## Database Schema

### User Roles

```sql
-- Add role enum and column to users table
CREATE TYPE user_role AS ENUM ('admin', 'contributor', 'reader');

ALTER TABLE tiger_den.users
  ADD COLUMN role user_role NOT NULL DEFAULT 'reader';
```

### Content Types Table

```sql
CREATE TABLE tiger_den.content_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) NOT NULL UNIQUE,
  color VARCHAR(20) NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX content_types_display_order_idx
  ON tiger_den.content_types(display_order);
```

### Migration Strategy

1. Create `content_types` table
2. Seed initial types:
   - youtube_video → "YouTube Video" (red)
   - blog_post → "Blog Post" (blue)
   - case_study → "Case Study" (green)
   - website_content → "Website Content" (purple)
   - third_party → "Third Party" (yellow)
   - other → "Other" (gray, is_system=true)
3. Add `content_type_id INTEGER` to `content_items` table
4. Migrate existing enum values to content_type IDs
5. Drop `content_type` enum column
6. Add foreign key constraint to `content_types.id`
7. Add index on `content_type_id`

## Authorization Layer

### tRPC Procedures

```typescript
// Admin-only operations
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.session.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

// Contributor and Admin operations
export const contributorProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.session.user.role === 'reader') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Contributor access required' });
  }
  return next({ ctx });
});
```

### Route Protection Changes

- **Existing content CRUD** → Change to `contributorProcedure`
- **CSV import** → Change to `contributorProcedure`
- **Campaign management** → Change to `contributorProcedure`
- **Content type management** → Use `adminProcedure`
- **User role management** → Use `adminProcedure`
- **Queue operations** → Use `adminProcedure`
- **Search/read operations** → Stay as `protectedProcedure`

### NextAuth Integration

```typescript
// Add role to session
callbacks: {
  session: ({ session, user }) => ({
    ...session,
    user: {
      ...session.user,
      id: user.id,
      role: user.role,
    },
  }),

  // First user bootstrap
  async signIn({ user }) {
    const userCount = await db.select({ count: count() }).from(users);
    if (userCount[0].count === 0) {
      await db.update(users)
        .set({ role: 'admin' })
        .where(eq(users.id, user.id));
    }
    return true;
  },
}
```

## API Design

### Content Types Router

```typescript
export const contentTypesRouter = createTRPCRouter({
  // List all (ordered by display_order)
  list: protectedProcedure.query(),

  // Create new type
  create: adminProcedure
    .input(z.object({
      name: z.string().min(1).max(50),
      slug: z.string().regex(/^[a-z0-9_]+$/),
      color: z.enum(['red', 'blue', 'green', ...]),
    })),

  // Update type
  update: adminProcedure
    .input(z.object({ id: z.number(), name, slug, color })),

  // Delete type (checks usage)
  delete: adminProcedure
    .input(z.object({ id: z.number() })),

  // Reassign all items to another type, then delete
  reassignAndDelete: adminProcedure
    .input(z.object({ id: z.number(), reassignToId: z.number() })),

  // Reorder types
  reorder: adminProcedure
    .input(z.object({ ids: z.array(z.number()) })),
});
```

### Users Router

```typescript
export const usersRouter = createTRPCRouter({
  // List all users
  list: adminProcedure.query(),

  // Update user role
  updateRole: adminProcedure
    .input(z.object({
      userId: z.string(),
      role: z.enum(['admin', 'contributor', 'reader'])
    }))
    // Safety: Can't change own role, can't remove last admin

  // Get current user's role
  getMyRole: protectedProcedure.query(),
});
```

## UI Design

### Admin Section (`/admin`)

**Layout with sub-navigation:**
- `/admin/content-types` - Manage content types
- `/admin/users` - Manage user roles
- `/admin/queue` - Queue monitoring (existing, moved here)

**Navigation:**
- Add "Admin" link to main nav (only visible to admins)
- Admin layout checks role and redirects non-admins

### Content Types Page

**Features:**
- Table: Name, Slug, Color Badge, Item Count, Actions
- "Add Content Type" button
- Edit/Delete actions per row

**Add/Edit Dialog:**
- Name field (required, 1-50 chars)
- Slug field (auto-suggested from name, editable, validates format)
- Color picker (radio buttons with 10 predefined colors)
- Preview badge

**Delete Flow:**
- If no items use type → Simple confirmation
- If items exist → Warning dialog with options:
  - "Reassign all X items to 'Other' and delete"
  - "Cancel"
- System types (is_system=true) cannot be deleted

**Color Palette:**
Red, Blue, Green, Purple, Yellow, Orange, Pink, Cyan, Gray, Indigo

### User Management Page

**Features:**
- Table: Name, Email, Role Badge, Member Since
- Role dropdown in each row (saves on change)
- Current user's row disabled (can't change own role)
- Last admin's role locked (can't demote)

**Feedback:**
- Success toast on role change
- Error messages for protected operations

### Component Updates

**Content Form:**
- Fetch content types dynamically from API
- Store `contentTypeId` (number) instead of enum

**Content Filters:**
- Fetch types dynamically
- Filter by `contentTypeId`

**Content Badge:**
- Accept content type object with color
- Map color name to Tailwind classes

**Content Router:**
- Join with `content_types` table
- Return full type object with items

**CSV Import:**
- Map type names to IDs during import
- Default unknown types to "Other"
- Show warning in results

## Implementation Notes

### Validation Rules

**Content Types:**
- Name: 1-50 characters, required
- Slug: lowercase, underscores only, unique
- Color: must be from predefined palette
- System types: cannot be deleted or have slug changed

**User Roles:**
- Cannot change own role (prevents lockout)
- Cannot remove last admin (ensures admin access)
- All changes logged via updated_at

### Error Handling

**Content Type Deletion:**
- CONFLICT error if items exist (with count in data)
- FORBIDDEN error for system types

**Role Changes:**
- FORBIDDEN if changing own role
- FORBIDDEN if removing last admin

### Testing Considerations

- First user gets admin role correctly
- Non-admins cannot access /admin routes
- Content type with items blocks deletion
- Reassign-and-delete works correctly
- Role changes respect safety rules
- CSV import handles missing types

## Future Enhancements (Not in v1)

- Drag-and-drop content type reordering
- Bulk edit content items (change types in batch)
- User deletion/deactivation
- Audit log for admin actions
- Custom color input (beyond predefined palette)

## Success Criteria

- ✅ Three roles (Admin, Contributor, Reader) working
- ✅ First user becomes admin automatically
- ✅ Admins can create/edit/delete content types
- ✅ Content types stored in database (not hardcoded)
- ✅ Protected "Other" type exists
- ✅ Delete with reassignment works
- ✅ All existing features work with new auth
- ✅ CSV import handles dynamic types
- ✅ No breaking changes to existing data
