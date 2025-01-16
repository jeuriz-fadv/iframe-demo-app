import { Component, OnInit } from '@angular/core';
import {
  BehaviorSubject,
  catchError,
  from,
  map,
  Observable,
  of,
  switchMap,
  take,
} from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent implements OnInit {
  //const host = "ea-keycloak-dev.fadv.net";
  public host = 'ea-keycloak-qca.fadv.net';

  // The realm URL is also the Issuer
  public realmUrl = `https://${this.host}/realms/enterprise`;
  public tokenUrl = `${this.realmUrl}/protocol/openid-connect/token`;
  public logoutUrl = `${this.realmUrl}/protocol/openid-connect/logout`;

  public clientId = 'EA';
  //const clientSecret = "xU789zlFaWC1obLKeDha05HXXdlW1F8p";
  public clientSecret = 'pSMPzDV4TjqAjAlaYOmECaZGx8QcLDSh';

  //const requestedSubject = "02"0856PA/LPURVIS;
  public requestedSubject = '123456OCC/HEMA';

  public tokens: { refresh_token: string } | null = null;

  public isLoading = new BehaviorSubject<boolean>(false);

  ngOnInit(): void {
    window.addEventListener('message', (event) => {
      const e = event as MessageEvent;
      console.log('inside event listener', e.data.type);
      if (event.data.type === 'refreshTokens') {
        this.refreshTokens();
      }
      this.getTokens();
    });
    this.loadTokens();
  }

  private getTokens(): Observable<any> {
    if (this.tokens !== null) {
      return of(this.tokens);
    }
    if (this.isLoading.getValue() === true) {
      return this.isLoading.pipe(
        switchMap((loading) => {
          if (loading === false) {
            return of(this.tokens);
          }
          return this.isLoading.pipe(
            take(1),
            switchMap((loading) => {
              if (loading === false) {
                return of(this.tokens);
              }
              return of(null);
            })
          );
        })
      );
    }
    return of(this.tokens);
  }

  public loadTokens() {
    this.isLoading.next(true);
    if (this.tokens !== null) {
      console.warn('Tokens already loaded');
      this.isLoading.next(false);
      return;
    }
    const tokenReq = new URLSearchParams();
    tokenReq.set('client_id', this.clientId);
    tokenReq.set('client_secret', this.clientSecret);
    tokenReq.set(
      'grant_type',
      'urn:ietf:params:oauth:grant-type:token-exchange'
    );
    tokenReq.set('scope', 'openid');
    tokenReq.set('requested_subject', this.requestedSubject);

    from(
      fetch(this.tokenUrl, {
        method: 'POST',
        mode: 'cors',
        body: tokenReq,
      })
    )
      .pipe(
        take(1),
        switchMap((response) =>
          from(response.json()).pipe(map((result) => ({ response, result })))
        ),
        catchError((error) => {
          console.error('Token error: ', error);
          this.isLoading.next(false);
          return of(null);
        })
      )
      .subscribe((data) => {
        if (data === null) {
          this.isLoading.next(false);
          return;
        }
        const { response, result } = data;
        if (response.status !== 200) {
          this.tokens = null;
          console.error('Token status if status !200: ', response.status);
          console.error('Token result if status !200: ', result);
          this.isLoading.next(false);
          return;
        }

        this.tokens = result;
        console.info('Token status inside loadTokens sub: ', response.status);
        console.info('Token result inside loadTokens sub: ', this.tokens);

        const iframe = document.getElementById('iframe') as HTMLIFrameElement;

        if (iframe) {
          iframe?.contentWindow?.postMessage(
            this.tokens,
            'https://localhost.fadv.net:4200'
          );
        }
        this.isLoading.next(false);
      });
  }

  public logout() {
    if (this.tokens == null) {
      console.warn('Cannot logout: no tokens');
      return;
    }

    const logoutReq = new URLSearchParams();
    logoutReq.set('client_id', this.clientId);
    logoutReq.set('client_secret', this.clientSecret);
    logoutReq.set('refresh_token', this.tokens.refresh_token);

    from(
      fetch(this.logoutUrl, {
        method: 'POST',
        mode: 'cors',
        body: logoutReq,
      })
    )
      .pipe(
        switchMap((response) =>
          from(response.text()).pipe(map((result) => ({ response, result })))
        ),
        catchError((error) => {
          console.error('Logout error: ', error);
          return of(null);
        })
      )
      .subscribe((data) => {
        if (data === null) return;
        const { response, result } = data;
        if (!response.ok) {
          console.error('Logout status: ', response.status);
          console.error('Logout result: ', result);
          return;
        }

        console.info('Logout status in logout sub: ', response.status);
        console.info('Logout result in logout sub: ', result);
        console.info('Logout successful');
        this.tokens = null;
      });
  }

  public refreshTokens(): Observable<any> {
    this.isLoading.next(true);
    if (this.tokens === null) {
      console.warn('Cannot refresh tokens: no tokens');
      this.isLoading.next(false);
      return of(null);
    }

    const tokenReq = new URLSearchParams();
    tokenReq.set('client_id', this.clientId);
    tokenReq.set('client_secret', this.clientSecret);
    tokenReq.set('grant_type', 'refresh_token');
    tokenReq.set('scope', 'openid');
    tokenReq.set('refresh_token', this.tokens.refresh_token);

    return from(
      fetch(this.tokenUrl, {
        method: 'POST',
        mode: 'cors',
        body: tokenReq,
      })
    ).pipe(
      switchMap((response) =>
        from(response.json()).pipe(map((result) => ({ response, result })))
      ),
      catchError((error) => {
        console.error('Refresh tokens error: ', error);
        this.isLoading.next(false);
        return of(null);
      }),
      map((data) => {
        if (data === null) {
          this.isLoading.next(false);
          return null;
        }
        const { response, result } = data;
        if (response.status !== 200) {
          this.tokens = null;
          console.error('Refresh tokens status: ', response.status);
          console.error('Refresh tokens result: ', result);
          this.isLoading.next(false);
          return null;
        }

        this.tokens = result;
        console.info('Refresh tokens successful');
        console.info('Refresh tokens result: ', this.tokens);
        this.isLoading.next(false);
        return this.tokens;
      })
    );
  }
}
