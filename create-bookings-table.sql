CREATE TABLE IF NOT EXISTS bookings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  room_id INT NOT NULL,
  room_name TEXT NOT NULL,
  checkin DATE NOT NULL,
  checkout DATE NOT NULL,
  guests INT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  total_price NUMERIC NOT NULL,
  status TEXT DEFAULT 'confirmed',
  payment_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own bookings"
ON bookings FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bookings"
ON bookings FOR INSERT
WITH CHECK (auth.uid() = user_id);
