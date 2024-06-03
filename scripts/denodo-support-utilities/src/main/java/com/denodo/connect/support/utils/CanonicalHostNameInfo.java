package com.denodo.connect.support.utils;

import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.util.Enumeration;
import java.util.HashSet;

public class CanonicalHostNameInfo {

    public CanonicalHostNameInfo() {
    }

		public static void main(String args[]) throws SocketException {

				Enumeration<NetworkInterface> networkInterfacesEnum = NetworkInterface.getNetworkInterfaces();

        System.out.println("Canonical host names:\n");

        HashSet<InetAddress> inetSet = new HashSet<InetAddress>();

				while (networkInterfacesEnum.hasMoreElements()) {
            NetworkInterface ni = networkInterfacesEnum.nextElement();
            Enumeration<InetAddress> inets = ni.getInetAddresses();

            while (inets.hasMoreElements()) {
              InetAddress addr = inets.nextElement();
              inetSet.add(addr);
            }
        }

        boolean isFirst = true;
        for (InetAddress inetAddress : inetSet) {
          if(!isFirst) System.out.print(", ");
          System.out.print(inetAddress.getCanonicalHostName());
          isFirst = false;
        }

				System.out.println("\n");
	  }
}
