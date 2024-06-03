package com.denodo.connect.support.utils;

import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.util.Enumeration;
import java.util.HashSet;

public class NetworkInfo {

    public NetworkInfo() {
    }

    public static void main(String args[]) {

      Enumeration<NetworkInterface> netInterfaces = null;

      try {
        netInterfaces = NetworkInterface.getNetworkInterfaces();
      } catch(SocketException se) {
        se.printStackTrace();
      }

      System.out.println("List of network interfaces:\n");

      HashSet<InetAddress> loopbackSet = new HashSet<InetAddress>();
      HashSet<InetAddress> localSet = new HashSet<InetAddress>();

      while(netInterfaces.hasMoreElements()) {

        NetworkInterface net = netInterfaces.nextElement();
        InetAddress ipAddr;

        for(Enumeration<InetAddress> addresses = net.getInetAddresses(); addresses.hasMoreElements();) {
          ipAddr = addresses.nextElement();

          if(ipAddr.isLoopbackAddress()) {
          	loopbackSet.add(ipAddr);
          } else {
          	localSet.add(ipAddr);
          }
        }
      }

      System.out.print(" Loopback: ");
      boolean isFirst = true;
      for (InetAddress inetAddress : loopbackSet) {
        if(!isFirst) System.out.print(", ");
      	System.out.print(inetAddress.getHostAddress());
        isFirst = false;
      }

      System.out.print("\n");
      System.out.print(" Other: ");
      isFirst = true;
      for (InetAddress inetAddress : localSet) {
        if(!isFirst) System.out.print(", ");
        if(args.length == 0) {
      	   System.out.print(inetAddress.getHostAddress());
        } else {
      	   System.out.print(normalizeInetAddress(inetAddress.getHostAddress()));
        }
        isFirst = false;
		}

      System.out.println("\n");
  }

	private static String normalizeInetAddress(String hostAddress) {

		if(hostAddress != null) {
			int index = hostAddress.indexOf('%');
			if(index != -1) {
				return hostAddress.substring(0, index);
			} else {
				return hostAddress;
			}
		}

		return null;
	}
}
